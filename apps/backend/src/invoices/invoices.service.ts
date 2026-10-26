import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type { RoundingMode } from '@invoice-gst/shared';
import { Prisma } from '@prisma/client';
import { gstMismatchCode, recomputeInvoiceTotals } from '../gst/assertGstMatch';
import { PrismaService } from '../prisma.service';
import { stableStringify } from '../sync/policy';
import { nextServerVersion } from '../sync/serverVersion';
import { invoicePayloadSchema, type InvoicePayload } from './invoice.schema';

@Injectable()
export class InvoicesService {
  constructor(private readonly prisma: PrismaService) {}

  async list(vendorId: string) {
    const rows = await this.prisma.invoice.findMany({
      where: { vendorId },
      orderBy: { createdAt: 'desc' },
      include: { items: true, payments: true },
    });
    return rows.map(serializeInvoice);
  }

  async get(vendorId: string, id: string) {
    const row = await this.prisma.invoice.findFirst({
      where: { id, vendorId },
      include: { items: true, payments: true },
    });
    if (!row) {
      throw new NotFoundException('Invoice not found');
    }
    return serializeInvoice(row);
  }

  parse(body: unknown): InvoicePayload {
    const parsed = invoicePayloadSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.issues[0]?.message ?? 'Invalid invoice');
    }
    return parsed.data;
  }

  async create(vendorId: string, payload: InvoicePayload) {
    const existing = await this.prisma.invoice.findFirst({
      where: { id: payload.id, vendorId },
      include: { items: true, payments: true },
    });
    if (existing) {
      const same = stableStringify(identity(payload)) === stableStringify(identity(serializeInvoice(existing)));
      if (!same) {
        throw new BadRequestException('INVOICE_IMMUTABLE');
      }
      return { status: 'duplicate' as const, invoice: serializeInvoice(existing) };
    }

    const gst = await this.prisma.gstConfiguration.findUnique({ where: { vendorId } });
    const roundingMode = (gst?.roundingMode ?? 'nearest') as RoundingMode;
    const computed = recomputeInvoiceTotals({
      lines: payload.items.map((item) => ({
        quantityMilli: item.quantityMilli,
        unitPricePaise: item.unitPricePaise,
        gstRateBps: item.gstRateBps,
        priceInclusive: item.priceInclusive,
        lineDiscountPaise: item.lineDiscountPaise ?? 0,
      })),
      invoiceDiscountPaise: payload.discountPaise,
      isInterState: payload.isInterState,
      roundingMode,
      compositionScheme: gst?.compositionScheme ?? false,
    });
    if (
      gstMismatchCode(
        {
          taxablePaise: payload.taxablePaise,
          cgstPaise: payload.cgstPaise,
          sgstPaise: payload.sgstPaise,
          igstPaise: payload.igstPaise,
          totalPaise: payload.totalPaise,
        },
        computed,
      )
    ) {
      throw new BadRequestException('GST_MISMATCH');
    }

    const createdAt = new Date(payload.createdAt);
    const updatedAt = new Date(payload.updatedAt);
    const serverVersion = await nextServerVersion(this.prisma);
    await this.prisma.invoice.create({
      data: {
        id: payload.id,
        vendorId,
        invoiceNumber: payload.invoiceNumber,
        financialYear: payload.financialYear,
        customerId: payload.customerId,
        customerSnapshot: payload.customerSnapshot,
        placeOfSupplyStateCode: payload.placeOfSupplyStateCode,
        isInterState: payload.isInterState,
        status: 'finalized',
        subtotalPaise: BigInt(computed.subtotalPaise),
        discountPaise: BigInt(computed.discountPaise),
        taxablePaise: BigInt(computed.taxablePaise),
        cgstPaise: BigInt(computed.cgstPaise),
        sgstPaise: BigInt(computed.sgstPaise),
        igstPaise: BigInt(computed.igstPaise),
        roundOffPaise: BigInt(computed.roundOffPaise),
        totalPaise: BigInt(computed.totalPaise),
        paymentStatus: payload.paymentStatus,
        notes: payload.notes,
        createdAt,
        updatedAt,
        serverVersion,
        finalizedAt: payload.finalizedAt ? new Date(payload.finalizedAt) : createdAt,
        items: {
          create: payload.items.map((item, index) => {
            const line = computed.lines[index];
            return {
              id: item.id,
              productId: item.productId,
              productNameSnapshot: item.productNameSnapshot,
              localNameSnapshot: item.localNameSnapshot,
              hsnSnapshot: item.hsnSnapshot,
              unitSnapshot: item.unitSnapshot,
              quantityMilli: BigInt(item.quantityMilli),
              unitPricePaise: BigInt(item.unitPricePaise),
              gstRateBps: item.gstRateBps,
              priceInclusive: item.priceInclusive,
              taxablePaise: BigInt(line?.taxablePaise ?? 0),
              cgstPaise: BigInt(line?.cgstPaise ?? 0),
              sgstPaise: BigInt(line?.sgstPaise ?? 0),
              igstPaise: BigInt(line?.igstPaise ?? 0),
              lineTotalPaise: BigInt(line?.lineTotalPaise ?? 0),
            };
          }),
        },
        payments: {
          create: (payload.payments ?? []).map((payment) => ({
            id: payment.id,
            vendorId,
            method: payment.method,
            amountPaise: BigInt(payment.amountPaise),
            paidAt: new Date(payment.paidAt),
            reference: payment.reference,
            createdAt,
            updatedAt,
          })),
        },
      },
    });
    return { status: 'applied' as const, invoice: await this.get(vendorId, payload.id) };
  }

  async cancel(vendorId: string, id: string) {
    const existing = await this.prisma.invoice.findFirst({ where: { id, vendorId } });
    if (!existing) {
      throw new NotFoundException('Invoice not found');
    }
    if (existing.status === 'cancelled') {
      return { status: 'duplicate' as const };
    }
    if (existing.status !== 'finalized') {
      throw new BadRequestException('INVOICE_STATE');
    }
    const serverVersion = await nextServerVersion(this.prisma);
    await this.prisma.invoice.update({
      where: { id },
      data: { status: 'cancelled', updatedAt: new Date(), serverVersion },
    });
    return { status: 'applied' as const };
  }

  /** Replace lines/totals on an unpaid finalized invoice; keeps invoice number. */
  async replaceUnpaid(vendorId: string, payload: InvoicePayload) {
    const existing = await this.prisma.invoice.findFirst({
      where: { id: payload.id, vendorId },
      include: { items: true, payments: true },
    });
    if (!existing) {
      throw new NotFoundException('Invoice not found');
    }
    if (existing.status !== 'finalized') {
      throw new BadRequestException('INVOICE_STATE');
    }
    if (existing.paymentStatus === 'paid') {
      throw new BadRequestException('INVOICE_IMMUTABLE');
    }
    if (payload.invoiceNumber !== existing.invoiceNumber) {
      throw new BadRequestException('INVOICE_NUMBER_LOCKED');
    }

    const gst = await this.prisma.gstConfiguration.findUnique({ where: { vendorId } });
    const roundingMode = (gst?.roundingMode ?? 'nearest') as RoundingMode;
    const computed = recomputeInvoiceTotals({
      lines: payload.items.map((item) => ({
        quantityMilli: item.quantityMilli,
        unitPricePaise: item.unitPricePaise,
        gstRateBps: item.gstRateBps,
        priceInclusive: item.priceInclusive,
        lineDiscountPaise: item.lineDiscountPaise ?? 0,
      })),
      invoiceDiscountPaise: payload.discountPaise,
      isInterState: payload.isInterState,
      roundingMode,
      compositionScheme: gst?.compositionScheme ?? false,
    });
    if (
      gstMismatchCode(
        {
          taxablePaise: payload.taxablePaise,
          cgstPaise: payload.cgstPaise,
          sgstPaise: payload.sgstPaise,
          igstPaise: payload.igstPaise,
          totalPaise: payload.totalPaise,
        },
        computed,
      )
    ) {
      throw new BadRequestException('GST_MISMATCH');
    }

    const updatedAt = new Date(payload.updatedAt);
    const serverVersion = await nextServerVersion(this.prisma);
    await this.prisma.$transaction(async (tx) => {
      await tx.invoiceItem.deleteMany({ where: { invoiceId: payload.id } });
      await tx.payment.deleteMany({ where: { invoiceId: payload.id } });
      await tx.invoice.update({
        where: { id: payload.id },
        data: {
          customerId: payload.customerId,
          customerSnapshot: payload.customerSnapshot,
          placeOfSupplyStateCode: payload.placeOfSupplyStateCode,
          isInterState: payload.isInterState,
          subtotalPaise: BigInt(computed.subtotalPaise),
          discountPaise: BigInt(computed.discountPaise),
          taxablePaise: BigInt(computed.taxablePaise),
          cgstPaise: BigInt(computed.cgstPaise),
          sgstPaise: BigInt(computed.sgstPaise),
          igstPaise: BigInt(computed.igstPaise),
          roundOffPaise: BigInt(computed.roundOffPaise),
          totalPaise: BigInt(computed.totalPaise),
          paymentStatus: payload.paymentStatus,
          notes: payload.notes,
          updatedAt,
          serverVersion,
          items: {
            create: payload.items.map((item, index) => {
              const line = computed.lines[index];
              return {
                id: item.id,
                productId: item.productId,
                productNameSnapshot: item.productNameSnapshot,
                localNameSnapshot: item.localNameSnapshot,
                hsnSnapshot: item.hsnSnapshot,
                unitSnapshot: item.unitSnapshot,
                quantityMilli: BigInt(item.quantityMilli),
                unitPricePaise: BigInt(item.unitPricePaise),
                gstRateBps: item.gstRateBps,
                priceInclusive: item.priceInclusive,
                taxablePaise: BigInt(line?.taxablePaise ?? 0),
                cgstPaise: BigInt(line?.cgstPaise ?? 0),
                sgstPaise: BigInt(line?.sgstPaise ?? 0),
                igstPaise: BigInt(line?.igstPaise ?? 0),
                lineTotalPaise: BigInt(line?.lineTotalPaise ?? 0),
              };
            }),
          },
          payments: {
            create: (payload.payments ?? []).map((payment) => ({
              id: payment.id,
              vendorId,
              method: payment.method,
              amountPaise: BigInt(payment.amountPaise),
              paidAt: new Date(payment.paidAt),
              reference: payment.reference,
              createdAt: updatedAt,
              updatedAt,
            })),
          },
        },
      });
    });
    return { status: 'applied' as const, invoice: await this.get(vendorId, payload.id) };
  }
}

function identity(invoice: InvoicePayload) {
  return {
    id: invoice.id,
    invoiceNumber: invoice.invoiceNumber,
    financialYear: invoice.financialYear,
    totalPaise: invoice.totalPaise,
    status: invoice.status,
    items: invoice.items.map((item) => item.id).sort(),
  };
}

type InvoiceRow = Prisma.InvoiceGetPayload<{ include: { items: true; payments: true } }>;

function serializeInvoice(row: InvoiceRow): InvoicePayload {
  return {
    id: row.id,
    invoiceNumber: row.invoiceNumber,
    financialYear: row.financialYear,
    customerId: row.customerId,
    customerSnapshot: row.customerSnapshot as InvoicePayload['customerSnapshot'],
    placeOfSupplyStateCode: row.placeOfSupplyStateCode,
    isInterState: row.isInterState,
    status: row.status === 'cancelled' ? 'cancelled' : 'finalized',
    subtotalPaise: Number(row.subtotalPaise),
    discountPaise: Number(row.discountPaise),
    taxablePaise: Number(row.taxablePaise),
    cgstPaise: Number(row.cgstPaise),
    sgstPaise: Number(row.sgstPaise),
    igstPaise: Number(row.igstPaise),
    roundOffPaise: Number(row.roundOffPaise),
    totalPaise: Number(row.totalPaise),
    paymentStatus: row.paymentStatus as InvoicePayload['paymentStatus'],
    notes: row.notes,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    finalizedAt: row.finalizedAt ? row.finalizedAt.toISOString() : null,
    items: row.items.map((item) => ({
      id: item.id,
      productId: item.productId,
      productNameSnapshot: item.productNameSnapshot,
      localNameSnapshot: item.localNameSnapshot,
      hsnSnapshot: item.hsnSnapshot,
      unitSnapshot: item.unitSnapshot,
      quantityMilli: Number(item.quantityMilli),
      unitPricePaise: Number(item.unitPricePaise),
      gstRateBps: item.gstRateBps,
      priceInclusive: item.priceInclusive,
      taxablePaise: Number(item.taxablePaise),
      cgstPaise: Number(item.cgstPaise),
      sgstPaise: Number(item.sgstPaise),
      igstPaise: Number(item.igstPaise),
      lineTotalPaise: Number(item.lineTotalPaise),
    })),
    payments: row.payments.map((payment) => ({
      id: payment.id,
      method: payment.method as 'cash' | 'upi' | 'card' | 'credit',
      amountPaise: Number(payment.amountPaise),
      paidAt: payment.paidAt.toISOString(),
      reference: payment.reference,
    })),
  };
}
