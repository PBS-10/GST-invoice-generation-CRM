import { BadRequestException, Injectable } from '@nestjs/common';
import { syncPullSchema, syncPushSchema, type SyncChange } from '@invoice-gst/validation';
import { randomUUID } from 'node:crypto';
import { DevicesService } from '../devices/devices.service';
import { InvoicesService } from '../invoices/invoices.service';
import { PrismaService } from '../prisma.service';
import {
  clampClientUpdatedAt,
  invoiceCancelDecision,
  invoiceCreateDecision,
  masterDataDecision,
  stableStringify,
  type SyncResultStatus,
} from './policy';
import { hashVendorLockKey, nextServerVersion } from './serverVersion';

type SyncResult = {
  idempotencyKey: string;
  status: SyncResultStatus;
  code?: string;
  serverUpdatedAt?: string;
};

@Injectable()
export class SyncService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly invoices: InvoicesService,
    private readonly devices: DevicesService,
  ) {}

  async push(vendorId: string, deviceId: string, body: unknown) {
    const parsed = syncPushSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.issues[0]?.message ?? 'Invalid sync batch');
    }

    const lockKey = hashVendorLockKey(vendorId);
    // Session-level lock: Prisma may use different pool connections per query,
    // so we serialize vendor batches with a named advisory lock around the work.
    await this.prisma.$executeRaw`SELECT pg_advisory_lock(${lockKey})`;
    try {
      const results: SyncResult[] = [];
      for (const change of parsed.data.changes) {
        results.push(await this.applyOne(vendorId, change));
      }
      await this.devices.touchSync(deviceId);
      return { results };
    } finally {
      await this.prisma.$executeRaw`SELECT pg_advisory_unlock(${lockKey})`;
    }
  }

  async pull(vendorId: string, deviceId: string, body: unknown) {
    const parsed = syncPullSchema.safeParse(body ?? {});
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.issues[0]?.message ?? 'Invalid sync pull');
    }
    const cursorRaw = parsed.data.cursor;
    const cursor =
      cursorRaw == null || cursorRaw === ''
        ? 0n
        : BigInt(typeof cursorRaw === 'number' ? cursorRaw : cursorRaw);
    const limit = parsed.data.limit ?? 100;

    const [vendor, gst, products, customers, invoices] = await Promise.all([
      this.prisma.vendor.findFirst({
        where: { id: vendorId, serverVersion: { gt: cursor } },
      }),
      this.prisma.gstConfiguration.findFirst({
        where: { vendorId, serverVersion: { gt: cursor } },
      }),
      this.prisma.product.findMany({
        where: { vendorId, serverVersion: { gt: cursor } },
        orderBy: { serverVersion: 'asc' },
        take: limit,
      }),
      this.prisma.customer.findMany({
        where: { vendorId, serverVersion: { gt: cursor } },
        orderBy: { serverVersion: 'asc' },
        take: limit,
      }),
      this.prisma.invoice.findMany({
        where: { vendorId, serverVersion: { gt: cursor } },
        orderBy: { serverVersion: 'asc' },
        take: limit,
        include: { items: true, payments: true },
      }),
    ]);

    const versions: bigint[] = [];
    if (vendor) {
      versions.push(vendor.serverVersion);
    }
    if (gst) {
      versions.push(gst.serverVersion);
    }
    for (const row of products) {
      versions.push(row.serverVersion);
    }
    for (const row of customers) {
      versions.push(row.serverVersion);
    }
    for (const row of invoices) {
      versions.push(row.serverVersion);
    }
    versions.sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));

    const pageCeiling =
      versions.length > limit ? versions[limit - 1]! : versions[versions.length - 1] ?? cursor;
    const hasMore = versions.length > limit || products.length === limit || customers.length === limit || invoices.length === limit;

    const filterVersion = (version: bigint) => version > cursor && version <= pageCeiling;

    await this.devices.touchSync(deviceId);
    return {
      vendor: vendor && filterVersion(vendor.serverVersion) ? serializeVendor(vendor) : null,
      gstConfiguration: gst && filterVersion(gst.serverVersion) ? serializeGst(gst) : null,
      products: products
        .filter((row) => filterVersion(row.serverVersion))
        .map((row) => ({
          ...row,
          sellingPricePaise: Number(row.sellingPricePaise),
          serverVersion: row.serverVersion.toString(),
          createdAt: row.createdAt.toISOString(),
          updatedAt: row.updatedAt.toISOString(),
          deletedAt: row.deletedAt?.toISOString() ?? null,
        })),
      customers: customers
        .filter((row) => filterVersion(row.serverVersion))
        .map((row) => ({
          ...row,
          serverVersion: row.serverVersion.toString(),
          createdAt: row.createdAt.toISOString(),
          updatedAt: row.updatedAt.toISOString(),
          deletedAt: row.deletedAt?.toISOString() ?? null,
        })),
      invoices: invoices
        .filter((row) => filterVersion(row.serverVersion))
        .map((row) => serializeInvoice(row)),
      nextCursor: pageCeiling.toString(),
      hasMore,
    };
  }

  private async applyOne(vendorId: string, change: SyncChange): Promise<SyncResult> {
    const prior = await this.prisma.idempotencyKey.findUnique({
      where: { vendorId_key: { vendorId, key: change.idempotencyKey } },
    });
    if (prior) {
      return prior.response as SyncResult;
    }
    const result = await this.dispatch(vendorId, change);
    await this.prisma.idempotencyKey.create({
      data: {
        id: randomUUID(),
        vendorId,
        key: change.idempotencyKey,
        status: result.status,
        response: result,
        createdAt: new Date(),
      },
    });
    return result;
  }

  private async dispatch(vendorId: string, change: SyncChange): Promise<SyncResult> {
    switch (change.entityType) {
      case 'invoice':
        return this.applyInvoice(vendorId, change);
      case 'product':
        return this.applyProduct(vendorId, change);
      case 'customer':
        return this.applyCustomer(vendorId, change);
      case 'vendor':
        return this.applyVendor(vendorId, change);
      case 'gst_configuration':
        return this.applyGstConfiguration(vendorId, change);
      default:
        return { idempotencyKey: change.idempotencyKey, status: 'rejected', code: 'UNKNOWN_ENTITY' };
    }
  }

  private async applyVendor(vendorId: string, change: SyncChange): Promise<SyncResult> {
    const existing = await this.prisma.vendor.findUnique({ where: { id: vendorId } });
    const clientAt = clampClientUpdatedAt(change.clientUpdatedAt);
    const decision = masterDataDecision({
      exists: Boolean(existing),
      serverUpdatedAt: existing?.updatedAt.toISOString() ?? null,
      clientUpdatedAt: clientAt.toISOString(),
    });
    if (decision === 'conflict') {
      return {
        idempotencyKey: change.idempotencyKey,
        status: 'conflict',
        serverUpdatedAt: existing?.updatedAt.toISOString(),
      };
    }
    if (decision === 'duplicate') {
      return { idempotencyKey: change.idempotencyKey, status: 'duplicate' };
    }
    const payload = asRecord(change.payload);
    const version = await nextServerVersion(this.prisma);
    await this.prisma.vendor.update({
      where: { id: vendorId },
      data: {
        businessName: String(payload.businessName ?? existing?.businessName ?? 'Shop'),
        tradeName: (payload.tradeName as string | null | undefined) ?? null,
        gstin: (payload.gstin as string | null | undefined) ?? null,
        phone: (payload.phone as string | null | undefined) ?? null,
        email: (payload.email as string | null | undefined) ?? null,
        addressLine1: (payload.addressLine1 as string | null | undefined) ?? null,
        addressLine2: (payload.addressLine2 as string | null | undefined) ?? null,
        city: (payload.city as string | null | undefined) ?? null,
        stateCode: String(payload.stateCode ?? existing?.stateCode ?? '32'),
        pincode: (payload.pincode as string | null | undefined) ?? null,
        gstRegistrationType: String(payload.gstRegistrationType ?? existing?.gstRegistrationType ?? 'regular'),
        invoicePrefix: String(payload.invoicePrefix ?? existing?.invoicePrefix ?? 'INV').slice(0, 3).toUpperCase(),
        updatedAt: clientAt,
        serverVersion: version,
      },
    });
    return { idempotencyKey: change.idempotencyKey, status: 'applied' };
  }

  private async applyGstConfiguration(vendorId: string, change: SyncChange): Promise<SyncResult> {
    const existing = await this.prisma.gstConfiguration.findUnique({ where: { vendorId } });
    const clientAt = clampClientUpdatedAt(change.clientUpdatedAt);
    const decision = masterDataDecision({
      exists: Boolean(existing),
      serverUpdatedAt: existing?.updatedAt.toISOString() ?? null,
      clientUpdatedAt: clientAt.toISOString(),
    });
    if (decision === 'conflict') {
      return {
        idempotencyKey: change.idempotencyKey,
        status: 'conflict',
        serverUpdatedAt: existing?.updatedAt.toISOString(),
      };
    }
    if (decision === 'duplicate') {
      return { idempotencyKey: change.idempotencyKey, status: 'duplicate' };
    }
    const payload = asRecord(change.payload);
    const version = await nextServerVersion(this.prisma);
    const data = {
      defaultGstRateBps: Number(payload.defaultGstRateBps ?? existing?.defaultGstRateBps ?? 1800),
      enableIgst: payload.enableIgst !== false,
      roundingMode: String(payload.roundingMode ?? existing?.roundingMode ?? 'nearest'),
      compositionScheme: Boolean(payload.compositionScheme),
      updatedAt: clientAt,
      serverVersion: version,
    };
    if (existing) {
      await this.prisma.gstConfiguration.update({ where: { vendorId }, data });
    } else {
      await this.prisma.gstConfiguration.create({
        data: {
          id: change.entityId,
          vendorId,
          ...data,
          createdAt: clientAt,
        },
      });
    }
    return { idempotencyKey: change.idempotencyKey, status: 'applied' };
  }

  private async applyInvoice(vendorId: string, change: SyncChange): Promise<SyncResult> {
    const payload = asRecord(change.payload);
    const existing = await this.prisma.invoice.findFirst({
      where: { id: change.entityId, vendorId },
      include: { items: true, payments: true },
    });
    const cancelling = change.operation === 'delete' || payload.status === 'cancelled';
    if (cancelling) {
      const decision = invoiceCancelDecision({
        exists: Boolean(existing),
        status: existing?.status ?? null,
      });
      if (decision.status === 'applied' && existing) {
        const version = await nextServerVersion(this.prisma);
        await this.prisma.invoice.update({
          where: { id: existing.id },
          data: {
            status: 'cancelled',
            updatedAt: clampClientUpdatedAt(change.clientUpdatedAt),
            serverVersion: version,
          },
        });
      }
      return { idempotencyKey: change.idempotencyKey, ...decision };
    }

    const parsed = this.invoices.parse({ ...payload, id: change.entityId });
    const decision = invoiceCreateDecision({
      exists: Boolean(existing),
      samePayload: existing
        ? stableStringify({
            total: Number(existing.totalPaise),
            number: existing.invoiceNumber,
            paymentStatus: existing.paymentStatus,
            items: existing.items.map((item) => item.id).sort(),
            updatedAt: existing.updatedAt.toISOString(),
          }) ===
          stableStringify({
            total: parsed.totalPaise,
            number: parsed.invoiceNumber,
            paymentStatus: parsed.paymentStatus,
            items: parsed.items.map((item) => item.id).sort(),
            updatedAt: parsed.updatedAt,
          })
        : false,
      gstOk: true,
      allowUnpaidReplace: Boolean(existing),
      paymentStatus: existing?.paymentStatus ?? null,
      status: existing?.status ?? null,
    });
    if (decision.status !== 'applied') {
      return { idempotencyKey: change.idempotencyKey, ...decision };
    }
    try {
      if (decision.code === 'UNPAID_REPLACE') {
        await this.invoices.replaceUnpaid(vendorId, parsed);
      } else {
        await this.invoices.create(vendorId, parsed);
      }
      return { idempotencyKey: change.idempotencyKey, status: 'applied' };
    } catch (error) {
      if (error instanceof BadRequestException) {
        return {
          idempotencyKey: change.idempotencyKey,
          status: 'rejected',
          code: String(error.message),
        };
      }
      throw error;
    }
  }

  private async applyProduct(vendorId: string, change: SyncChange): Promise<SyncResult> {
    const existing = await this.prisma.product.findFirst({
      where: { id: change.entityId, vendorId },
    });
    const clientAt = clampClientUpdatedAt(change.clientUpdatedAt);
    const decision = masterDataDecision({
      exists: Boolean(existing && !existing.deletedAt),
      serverUpdatedAt: existing ? existing.updatedAt.toISOString() : null,
      clientUpdatedAt: clientAt.toISOString(),
    });
    if (decision === 'conflict') {
      return {
        idempotencyKey: change.idempotencyKey,
        status: 'conflict',
        serverUpdatedAt: existing?.updatedAt.toISOString(),
      };
    }
    if (decision === 'duplicate') {
      return { idempotencyKey: change.idempotencyKey, status: 'duplicate' };
    }
    const version = await nextServerVersion(this.prisma);
    if (change.operation === 'delete') {
      if (existing) {
        await this.prisma.product.update({
          where: { id: existing.id },
          data: {
            deletedAt: clientAt,
            updatedAt: clientAt,
            isActive: false,
            serverVersion: version,
          },
        });
      }
      return { idempotencyKey: change.idempotencyKey, status: 'applied' };
    }
    const payload = asRecord(change.payload);
    const data = {
      name: String(payload.name ?? existing?.name ?? 'Item'),
      localName: (payload.localName as string | null | undefined) ?? null,
      aliases: (payload.aliases as string[] | undefined) ?? [],
      sku: (payload.sku as string | null | undefined) ?? null,
      hsnCode: (payload.hsnCode as string | null | undefined) ?? null,
      unit: String(payload.unit ?? 'pcs'),
      sellingPricePaise: BigInt(Number(payload.sellingPricePaise ?? 0)),
      gstRateBps: Number(payload.gstRateBps ?? 0),
      priceInclusive: Boolean(payload.priceInclusive),
      isActive: payload.isActive !== false,
      updatedAt: clientAt,
      deletedAt: null,
      serverVersion: version,
    };
    if (existing) {
      await this.prisma.product.update({ where: { id: existing.id }, data });
    } else {
      await this.prisma.product.create({
        data: { id: change.entityId, vendorId, ...data, createdAt: clientAt },
      });
    }
    return { idempotencyKey: change.idempotencyKey, status: 'applied' };
  }

  private async applyCustomer(vendorId: string, change: SyncChange): Promise<SyncResult> {
    const existing = await this.prisma.customer.findFirst({
      where: { id: change.entityId, vendorId },
    });
    const clientAt = clampClientUpdatedAt(change.clientUpdatedAt);
    const decision = masterDataDecision({
      exists: Boolean(existing && !existing.deletedAt),
      serverUpdatedAt: existing ? existing.updatedAt.toISOString() : null,
      clientUpdatedAt: clientAt.toISOString(),
    });
    if (decision === 'conflict') {
      return {
        idempotencyKey: change.idempotencyKey,
        status: 'conflict',
        serverUpdatedAt: existing?.updatedAt.toISOString(),
      };
    }
    if (decision === 'duplicate') {
      return { idempotencyKey: change.idempotencyKey, status: 'duplicate' };
    }
    const version = await nextServerVersion(this.prisma);
    if (change.operation === 'delete') {
      if (existing) {
        await this.prisma.customer.update({
          where: { id: existing.id },
          data: { deletedAt: clientAt, updatedAt: clientAt, serverVersion: version },
        });
      }
      return { idempotencyKey: change.idempotencyKey, status: 'applied' };
    }
    const payload = asRecord(change.payload);
    const data = {
      name: String(payload.name ?? existing?.name ?? 'Customer'),
      phone: (payload.phone as string | null | undefined) ?? null,
      email: (payload.email as string | null | undefined) ?? null,
      addressLine1: (payload.addressLine1 as string | null | undefined) ?? null,
      city: (payload.city as string | null | undefined) ?? null,
      stateCode: (payload.stateCode as string | null | undefined) ?? null,
      pincode: (payload.pincode as string | null | undefined) ?? null,
      gstin: (payload.gstin as string | null | undefined) ?? null,
      customerType: String(payload.customerType ?? 'b2c'),
      updatedAt: clientAt,
      deletedAt: null,
      serverVersion: version,
    };
    if (existing) {
      await this.prisma.customer.update({ where: { id: existing.id }, data });
    } else {
      await this.prisma.customer.create({
        data: { id: change.entityId, vendorId, ...data, createdAt: clientAt },
      });
    }
    return { idempotencyKey: change.idempotencyKey, status: 'applied' };
  }
}

function asRecord(value: unknown): Record<string, unknown> {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
}

function serializeVendor(row: {
  id: string;
  businessName: string;
  tradeName: string | null;
  gstin: string | null;
  phone: string | null;
  email: string | null;
  addressLine1: string | null;
  addressLine2: string | null;
  city: string | null;
  stateCode: string;
  pincode: string | null;
  gstRegistrationType: string;
  invoicePrefix: string;
  logoUri: string | null;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
  serverVersion: bigint;
}) {
  return {
    ...row,
    serverVersion: row.serverVersion.toString(),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    deletedAt: row.deletedAt?.toISOString() ?? null,
  };
}

function serializeGst(row: {
  id: string;
  vendorId: string;
  defaultGstRateBps: number;
  enableIgst: boolean;
  roundingMode: string;
  compositionScheme: boolean;
  createdAt: Date;
  updatedAt: Date;
  serverVersion: bigint;
}) {
  return {
    ...row,
    serverVersion: row.serverVersion.toString(),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function serializeInvoice(row: {
  id: string;
  invoiceNumber: string;
  financialYear: string;
  customerId: string | null;
  customerSnapshot: unknown;
  placeOfSupplyStateCode: string;
  isInterState: boolean;
  status: string;
  subtotalPaise: bigint;
  discountPaise: bigint;
  taxablePaise: bigint;
  cgstPaise: bigint;
  sgstPaise: bigint;
  igstPaise: bigint;
  roundOffPaise: bigint;
  totalPaise: bigint;
  paymentStatus: string;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
  finalizedAt: Date | null;
  serverVersion: bigint;
  items: Array<Record<string, unknown> & {
    quantityMilli: bigint;
    unitPricePaise: bigint;
    taxablePaise: bigint;
    cgstPaise: bigint;
    sgstPaise: bigint;
    igstPaise: bigint;
    lineTotalPaise: bigint;
  }>;
  payments: Array<Record<string, unknown> & { amountPaise: bigint; paidAt: Date; createdAt: Date; updatedAt: Date }>;
}) {
  return {
    id: row.id,
    invoiceNumber: row.invoiceNumber,
    financialYear: row.financialYear,
    customerId: row.customerId,
    customerSnapshot: row.customerSnapshot,
    placeOfSupplyStateCode: row.placeOfSupplyStateCode,
    isInterState: row.isInterState,
    status: row.status,
    subtotalPaise: Number(row.subtotalPaise),
    discountPaise: Number(row.discountPaise),
    taxablePaise: Number(row.taxablePaise),
    cgstPaise: Number(row.cgstPaise),
    sgstPaise: Number(row.sgstPaise),
    igstPaise: Number(row.igstPaise),
    roundOffPaise: Number(row.roundOffPaise),
    totalPaise: Number(row.totalPaise),
    paymentStatus: row.paymentStatus,
    notes: row.notes,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    finalizedAt: row.finalizedAt?.toISOString() ?? null,
    serverVersion: row.serverVersion.toString(),
    items: row.items.map((item) => ({
      ...item,
      quantityMilli: Number(item.quantityMilli),
      unitPricePaise: Number(item.unitPricePaise),
      taxablePaise: Number(item.taxablePaise),
      cgstPaise: Number(item.cgstPaise),
      sgstPaise: Number(item.sgstPaise),
      igstPaise: Number(item.igstPaise),
      lineTotalPaise: Number(item.lineTotalPaise),
    })),
    payments: row.payments.map((payment) => ({
      ...payment,
      amountPaise: Number(payment.amountPaise),
      paidAt: payment.paidAt.toISOString(),
      createdAt: payment.createdAt.toISOString(),
      updatedAt: payment.updatedAt.toISOString(),
    })),
  };
}
