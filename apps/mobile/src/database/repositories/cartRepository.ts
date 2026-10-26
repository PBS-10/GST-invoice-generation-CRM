import type { CustomerSnapshot, PaymentMethod } from '@invoice-gst/types';
import { desc, eq } from 'drizzle-orm';
import type { DraftLine, InvoiceDraftState } from '../../store/slices/invoiceDraftSlice';
import { nowIso } from '../../utils/clock';
import { createId } from '../../utils/id';
import type { AppDatabase } from '../client';
import { billingCartLines, billingCarts } from '../schema';
import { MAX_OPEN_CARTS } from './cartHelpers';

export { MAX_OPEN_CARTS, cartDisplayTitle } from './cartHelpers';

export type BillingCartHeader = {
  id: string;
  customerId: string | null;
  customerSnapshot: CustomerSnapshot;
  invoiceDiscountPaise: number;
  notes: string | null;
  paymentMethod: PaymentMethod;
  collectPayment: boolean;
  label: string | null;
  createdAt: string;
  updatedAt: string;
};

export type BillingCart = BillingCartHeader & {
  lines: DraftLine[];
};

export type OpenCartSummary = BillingCartHeader & {
  lineCount: number;
};

const walkInSnapshot: CustomerSnapshot = {
  name: 'Walk-in',
  phone: null,
  gstin: null,
  stateCode: null,
};

function parseSnapshot(raw: string): CustomerSnapshot {
  try {
    return JSON.parse(raw) as CustomerSnapshot;
  } catch {
    return walkInSnapshot;
  }
}

function defaultLabel(snapshot: CustomerSnapshot): string {
  return snapshot.name?.trim() || 'Walk-in';
}

export function createCartRepository(db: AppDatabase) {
  return {
    async countOpen(): Promise<number> {
      const rows = await db.select({ id: billingCarts.id }).from(billingCarts);
      return rows.length;
    },

    async listOpen(): Promise<OpenCartSummary[]> {
      const carts = await db
        .select()
        .from(billingCarts)
        .orderBy(desc(billingCarts.updatedAt));
      const result: OpenCartSummary[] = [];
      for (const cart of carts) {
        const lines = await db
          .select({ id: billingCartLines.id })
          .from(billingCartLines)
          .where(eq(billingCartLines.cartId, cart.id));
        result.push({
          id: cart.id,
          customerId: cart.customerId,
          customerSnapshot: parseSnapshot(cart.customerSnapshot),
          invoiceDiscountPaise: cart.invoiceDiscountPaise,
          notes: cart.notes,
          paymentMethod: cart.paymentMethod as PaymentMethod,
          collectPayment: cart.collectPayment === 1,
          label: cart.label,
          createdAt: cart.createdAt,
          updatedAt: cart.updatedAt,
          lineCount: lines.length,
        });
      }
      return result;
    },

    async get(id: string): Promise<BillingCart | null> {
      const rows = await db.select().from(billingCarts).where(eq(billingCarts.id, id)).limit(1);
      const cart = rows[0];
      if (!cart) {
        return null;
      }
      const lineRows = await db
        .select()
        .from(billingCartLines)
        .where(eq(billingCartLines.cartId, id));
      lineRows.sort((a, b) => a.sortIndex - b.sortIndex);
      return {
        id: cart.id,
        customerId: cart.customerId,
        customerSnapshot: parseSnapshot(cart.customerSnapshot),
        invoiceDiscountPaise: cart.invoiceDiscountPaise,
        notes: cart.notes,
        paymentMethod: cart.paymentMethod as PaymentMethod,
        collectPayment: cart.collectPayment === 1,
        label: cart.label,
        createdAt: cart.createdAt,
        updatedAt: cart.updatedAt,
        lines: lineRows.map((line) => ({
          key: line.id,
          productId: line.productId,
          productName: line.productName,
          localName: line.localName,
          hsnCode: line.hsnCode,
          unit: line.unit,
          quantityMilli: line.quantityMilli,
          unitPricePaise: line.unitPricePaise,
          gstRateBps: line.gstRateBps,
          priceInclusive: line.priceInclusive === 1,
          lineDiscountPaise: line.lineDiscountPaise,
        })),
      };
    },

    async create(input?: {
      customerId?: string | null;
      customerSnapshot?: CustomerSnapshot;
    }): Promise<BillingCart> {
      const open = await this.countOpen();
      if (open >= MAX_OPEN_CARTS) {
        throw new Error(`You can park at most ${MAX_OPEN_CARTS} bills. Finish or discard one first.`);
      }
      const timestamp = nowIso();
      const id = createId();
      const snapshot = input?.customerSnapshot ?? walkInSnapshot;
      await db.insert(billingCarts).values({
        id,
        customerId: input?.customerId ?? null,
        customerSnapshot: JSON.stringify(snapshot),
        invoiceDiscountPaise: 0,
        notes: null,
        paymentMethod: 'cash',
        collectPayment: 1,
        label: defaultLabel(snapshot),
        createdAt: timestamp,
        updatedAt: timestamp,
      });
      const created = await this.get(id);
      if (!created) {
        throw new Error('Cart create failed');
      }
      return created;
    },

    async saveDraft(cartId: string, draft: InvoiceDraftState): Promise<void> {
      const timestamp = nowIso();
      await db.transaction(async (tx) => {
        await tx
          .update(billingCarts)
          .set({
            customerId: draft.customerId,
            customerSnapshot: JSON.stringify(draft.customerSnapshot),
            invoiceDiscountPaise: draft.invoiceDiscountPaise,
            notes: draft.notes || null,
            paymentMethod: draft.paymentMethod,
            collectPayment: draft.collectPayment ? 1 : 0,
            label: defaultLabel(draft.customerSnapshot),
            updatedAt: timestamp,
          })
          .where(eq(billingCarts.id, cartId));
        await tx.delete(billingCartLines).where(eq(billingCartLines.cartId, cartId));
        if (draft.lines.length > 0) {
          await tx.insert(billingCartLines).values(
            draft.lines.map((line, index) => ({
              id: line.key,
              cartId,
              productId: line.productId,
              productName: line.productName,
              localName: line.localName,
              hsnCode: line.hsnCode,
              unit: line.unit,
              quantityMilli: line.quantityMilli,
              unitPricePaise: line.unitPricePaise,
              gstRateBps: line.gstRateBps,
              priceInclusive: line.priceInclusive ? 1 : 0,
              lineDiscountPaise: line.lineDiscountPaise,
              sortIndex: index,
            })),
          );
        }
      });
    },

    async delete(id: string): Promise<void> {
      await db.delete(billingCarts).where(eq(billingCarts.id, id));
    },
  };
}

export type CartRepository = ReturnType<typeof createCartRepository>;
