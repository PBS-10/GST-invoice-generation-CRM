import { formatInvoiceNumber } from '@invoice-gst/shared';
import type {
  Invoice,
  InvoiceItem,
  InvoiceWithItems,
  PaymentMethod,
} from '@invoice-gst/types';
import { and, desc, eq } from 'drizzle-orm';
import { nowIso } from '../../utils/clock';
import { InvoiceStateError } from '../../utils/errors';
import { createId } from '../../utils/id';
import type { AppDatabase } from '../client';
import { mapInvoice, mapInvoiceItem, mapPayment } from '../mappers';
import {
  auditEvents,
  invoiceItems,
  invoiceSequences,
  invoices,
  payments,
} from '../schema';
import { createAppMetaRepository } from './appMetaRepository';
import { createSyncQueueRepository } from './syncQueueRepository';

export type FinalizeInvoiceInput = {
  invoice: Omit<
    Invoice,
    | 'id'
    | 'invoiceNumber'
    | 'status'
    | 'createdAt'
    | 'updatedAt'
    | 'finalizedAt'
    | 'syncStatus'
  >;
  items: Array<Omit<InvoiceItem, 'id' | 'invoiceId'>>;
  payment?: { method: PaymentMethod; amountPaise: number; reference?: string | null };
  vendorId: string;
  prefix: string;
};

export function createInvoiceRepository(db: AppDatabase) {
  const queue = createSyncQueueRepository(db);
  const meta = createAppMetaRepository(db);

  return {
    async list(): Promise<Invoice[]> {
      const rows = await db.select().from(invoices).orderBy(desc(invoices.createdAt));
      return rows.map(mapInvoice);
    },

    async getWithItems(id: string): Promise<InvoiceWithItems | null> {
      const invoiceRows = await db.select().from(invoices).where(eq(invoices.id, id)).limit(1);
      const invoiceRow = invoiceRows[0];
      if (!invoiceRow) {
        return null;
      }
      const itemRows = await db.select().from(invoiceItems).where(eq(invoiceItems.invoiceId, id));
      const paymentRows = await db.select().from(payments).where(eq(payments.invoiceId, id));
      return {
        ...mapInvoice(invoiceRow),
        items: itemRows.map(mapInvoiceItem),
        payments: paymentRows.map(mapPayment),
      };
    },

    /** Next number that would be issued — does not consume the sequence. */
    async peekNextInvoiceNumber(vendorId: string, prefix: string, financialYear: string): Promise<string> {
      const seriesCode = await meta.getSeriesCode();
      const safePrefix = prefix.slice(0, 3).toUpperCase();
      const sequenceRows = await db
        .select()
        .from(invoiceSequences)
        .where(
          and(
            eq(invoiceSequences.vendorId, vendorId),
            eq(invoiceSequences.seriesCode, seriesCode),
            eq(invoiceSequences.financialYear, financialYear),
          ),
        )
        .limit(1);
      const sequence = sequenceRows[0]?.nextNumber ?? 1;
      return formatInvoiceNumber(safePrefix, seriesCode, financialYear, sequence);
    },

    async finalize(input: FinalizeInvoiceInput): Promise<InvoiceWithItems> {
      const timestamp = nowIso();
      const invoiceId = createId();
      const seriesCode = await meta.getSeriesCode();
      const prefix = input.prefix.slice(0, 3).toUpperCase();

      return db.transaction(async (tx) => {
        const sequenceRows = await tx
          .select()
          .from(invoiceSequences)
          .where(
            and(
              eq(invoiceSequences.vendorId, input.vendorId),
              eq(invoiceSequences.seriesCode, seriesCode),
              eq(invoiceSequences.financialYear, input.invoice.financialYear),
            ),
          )
          .limit(1);
        const existing = sequenceRows[0];

        let sequence: number;
        if (!existing) {
          sequence = 1;
          await tx.insert(invoiceSequences).values({
            id: createId(),
            vendorId: input.vendorId,
            financialYear: input.invoice.financialYear,
            seriesCode,
            nextNumber: 2,
          });
        } else {
          sequence = existing.nextNumber;
          await tx
            .update(invoiceSequences)
            .set({ nextNumber: existing.nextNumber + 1 })
            .where(eq(invoiceSequences.id, existing.id));
        }

        const invoiceNumber = formatInvoiceNumber(
          prefix,
          seriesCode,
          input.invoice.financialYear,
          sequence,
        );

        const itemRows = input.items.map((item) => ({
          ...item,
          id: createId(),
          invoiceId,
        }));

        await tx.insert(invoices).values({
          id: invoiceId,
          invoiceNumber,
          financialYear: input.invoice.financialYear,
          customerId: input.invoice.customerId,
          customerSnapshot: JSON.stringify(input.invoice.customerSnapshot),
          placeOfSupplyStateCode: input.invoice.placeOfSupplyStateCode,
          isInterState: input.invoice.isInterState ? 1 : 0,
          status: 'finalized',
          subtotalPaise: input.invoice.subtotalPaise,
          discountPaise: input.invoice.discountPaise,
          taxablePaise: input.invoice.taxablePaise,
          cgstPaise: input.invoice.cgstPaise,
          sgstPaise: input.invoice.sgstPaise,
          igstPaise: input.invoice.igstPaise,
          roundOffPaise: input.invoice.roundOffPaise,
          totalPaise: input.invoice.totalPaise,
          paymentStatus: input.invoice.paymentStatus,
          notes: input.invoice.notes,
          createdAt: timestamp,
          updatedAt: timestamp,
          finalizedAt: timestamp,
          syncStatus: 'pending',
        });

        for (const item of itemRows) {
          await tx.insert(invoiceItems).values({
            ...item,
            priceInclusive: item.priceInclusive ? 1 : 0,
          });
        }

        const paymentSnapshots: Array<{
          id: string;
          invoiceId: string;
          method: PaymentMethod;
          amountPaise: number;
          paidAt: string;
          reference: string | null;
          createdAt: string;
          updatedAt: string;
          syncStatus: 'pending';
        }> = [];

        if (input.payment && input.payment.amountPaise > 0) {
          const paymentId = createId();
          await tx.insert(payments).values({
            id: paymentId,
            invoiceId,
            method: input.payment.method,
            amountPaise: input.payment.amountPaise,
            paidAt: timestamp,
            reference: input.payment.reference ?? null,
            createdAt: timestamp,
            updatedAt: timestamp,
            syncStatus: 'pending',
          });
          paymentSnapshots.push({
            id: paymentId,
            invoiceId,
            method: input.payment.method,
            amountPaise: input.payment.amountPaise,
            paidAt: timestamp,
            reference: input.payment.reference ?? null,
            createdAt: timestamp,
            updatedAt: timestamp,
            syncStatus: 'pending',
          });
        }

        await tx.insert(auditEvents).values({
          id: createId(),
          entityType: 'invoice',
          entityId: invoiceId,
          action: 'finalized',
          payload: JSON.stringify({ invoiceNumber }),
          createdAt: timestamp,
        });

        const snapshot = {
          id: invoiceId,
          invoiceNumber,
          financialYear: input.invoice.financialYear,
          customerId: input.invoice.customerId,
          customerSnapshot: input.invoice.customerSnapshot,
          placeOfSupplyStateCode: input.invoice.placeOfSupplyStateCode,
          isInterState: input.invoice.isInterState,
          status: 'finalized' as const,
          subtotalPaise: input.invoice.subtotalPaise,
          discountPaise: input.invoice.discountPaise,
          taxablePaise: input.invoice.taxablePaise,
          cgstPaise: input.invoice.cgstPaise,
          sgstPaise: input.invoice.sgstPaise,
          igstPaise: input.invoice.igstPaise,
          roundOffPaise: input.invoice.roundOffPaise,
          totalPaise: input.invoice.totalPaise,
          paymentStatus: input.invoice.paymentStatus,
          notes: input.invoice.notes,
          createdAt: timestamp,
          updatedAt: timestamp,
          finalizedAt: timestamp,
          items: itemRows,
          payments: paymentSnapshots,
        };

        await queue.enqueue(tx, 'invoice', invoiceId, 'create', snapshot);

        return {
          ...snapshot,
          syncStatus: 'pending' as const,
        };
      });
    },

    /**
     * Replace lines/totals on an unpaid finalized invoice (same invoice number).
     * Paid or cancelled invoices cannot be edited.
     */
    async replaceUnpaid(
      id: string,
      input: {
        invoice: Omit<
          Invoice,
          | 'id'
          | 'invoiceNumber'
          | 'financialYear'
          | 'status'
          | 'createdAt'
          | 'updatedAt'
          | 'finalizedAt'
          | 'syncStatus'
        >;
        items: Array<Omit<InvoiceItem, 'id' | 'invoiceId'>>;
        payment?: { method: PaymentMethod; amountPaise: number; reference?: string | null };
      },
    ): Promise<InvoiceWithItems> {
      const current = await this.getWithItems(id);
      if (!current) {
        throw new InvoiceStateError('Invoice not found');
      }
      if (current.status !== 'finalized') {
        throw new InvoiceStateError('Only finalized invoices can be edited');
      }
      if (current.paymentStatus === 'paid') {
        throw new InvoiceStateError('Paid invoices cannot be edited. Cancel and create a new bill.');
      }

      const timestamp = nowIso();
      return db.transaction(async (tx) => {
        await tx.delete(invoiceItems).where(eq(invoiceItems.invoiceId, id));
        await tx.delete(payments).where(eq(payments.invoiceId, id));

        const itemRows = input.items.map((item) => ({
          ...item,
          id: createId(),
          invoiceId: id,
        }));
        for (const item of itemRows) {
          await tx.insert(invoiceItems).values({
            ...item,
            priceInclusive: item.priceInclusive ? 1 : 0,
          });
        }

        const paymentSnapshots: Array<{
          id: string;
          invoiceId: string;
          method: PaymentMethod;
          amountPaise: number;
          paidAt: string;
          reference: string | null;
          createdAt: string;
          updatedAt: string;
          syncStatus: 'pending';
        }> = [];
        if (input.payment && input.payment.amountPaise > 0) {
          const paymentId = createId();
          paymentSnapshots.push({
            id: paymentId,
            invoiceId: id,
            method: input.payment.method,
            amountPaise: input.payment.amountPaise,
            paidAt: timestamp,
            reference: input.payment.reference ?? null,
            createdAt: timestamp,
            updatedAt: timestamp,
            syncStatus: 'pending',
          });
          await tx.insert(payments).values({
            id: paymentId,
            invoiceId: id,
            method: input.payment.method,
            amountPaise: input.payment.amountPaise,
            paidAt: timestamp,
            reference: input.payment.reference ?? null,
            createdAt: timestamp,
            updatedAt: timestamp,
            syncStatus: 'pending',
          });
        }

        await tx
          .update(invoices)
          .set({
            customerId: input.invoice.customerId,
            customerSnapshot: JSON.stringify(input.invoice.customerSnapshot),
            placeOfSupplyStateCode: input.invoice.placeOfSupplyStateCode,
            isInterState: input.invoice.isInterState ? 1 : 0,
            subtotalPaise: input.invoice.subtotalPaise,
            discountPaise: input.invoice.discountPaise,
            taxablePaise: input.invoice.taxablePaise,
            cgstPaise: input.invoice.cgstPaise,
            sgstPaise: input.invoice.sgstPaise,
            igstPaise: input.invoice.igstPaise,
            roundOffPaise: input.invoice.roundOffPaise,
            totalPaise: input.invoice.totalPaise,
            paymentStatus: input.invoice.paymentStatus,
            notes: input.invoice.notes,
            updatedAt: timestamp,
            syncStatus: 'pending',
          })
          .where(eq(invoices.id, id));

        const snapshot = {
          id,
          invoiceNumber: current.invoiceNumber,
          financialYear: current.financialYear,
          customerId: input.invoice.customerId,
          customerSnapshot: input.invoice.customerSnapshot,
          placeOfSupplyStateCode: input.invoice.placeOfSupplyStateCode,
          isInterState: input.invoice.isInterState,
          status: 'finalized' as const,
          subtotalPaise: input.invoice.subtotalPaise,
          discountPaise: input.invoice.discountPaise,
          taxablePaise: input.invoice.taxablePaise,
          cgstPaise: input.invoice.cgstPaise,
          sgstPaise: input.invoice.sgstPaise,
          igstPaise: input.invoice.igstPaise,
          roundOffPaise: input.invoice.roundOffPaise,
          totalPaise: input.invoice.totalPaise,
          paymentStatus: input.invoice.paymentStatus,
          notes: input.invoice.notes,
          createdAt: current.createdAt,
          updatedAt: timestamp,
          finalizedAt: current.finalizedAt,
          items: itemRows,
          payments: paymentSnapshots,
        };

        await queue.enqueue(tx, 'invoice', id, 'update', snapshot);
        await tx.insert(auditEvents).values({
          id: createId(),
          entityType: 'invoice',
          entityId: id,
          action: 'finalized',
          payload: JSON.stringify({ invoiceNumber: current.invoiceNumber, replaced: true }),
          createdAt: timestamp,
        });

        return {
          ...snapshot,
          syncStatus: 'pending' as const,
        };
      });
    },

    async cancel(id: string): Promise<void> {
      const current = await this.getWithItems(id);
      if (!current) {
        throw new InvoiceStateError('Invoice not found');
      }
      if (current.status === 'cancelled') {
        throw new InvoiceStateError('Invoice is already cancelled');
      }
      if (current.status !== 'finalized') {
        throw new InvoiceStateError('Only finalized invoices can be cancelled');
      }

      const timestamp = nowIso();
      await db.transaction(async (tx) => {
        await tx
          .update(invoices)
          .set({ status: 'cancelled', updatedAt: timestamp, syncStatus: 'pending' })
          .where(eq(invoices.id, id));
        await tx.insert(auditEvents).values({
          id: createId(),
          entityType: 'invoice',
          entityId: id,
          action: 'cancelled',
          payload: JSON.stringify({ invoiceNumber: current.invoiceNumber }),
          createdAt: timestamp,
        });
        await queue.enqueue(tx, 'invoice', id, 'update', {
          ...current,
          status: 'cancelled',
          updatedAt: timestamp,
          syncStatus: 'pending',
        });
      });
    },
  };
}
