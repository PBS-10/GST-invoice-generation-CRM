import { z } from 'zod';

const snapshotSchema = z.object({
  name: z.string().min(1),
  phone: z.string().nullable(),
  gstin: z.string().nullable(),
  stateCode: z.string().nullable(),
});

const itemSchema = z.object({
  id: z.string().min(1),
  productId: z.string().nullable(),
  productNameSnapshot: z.string().min(1),
  localNameSnapshot: z.string().nullable(),
  hsnSnapshot: z.string().nullable(),
  unitSnapshot: z.string().min(1),
  quantityMilli: z.number().int().nonnegative(),
  unitPricePaise: z.number().int().nonnegative(),
  gstRateBps: z.number().int().nonnegative(),
  priceInclusive: z.boolean(),
  lineDiscountPaise: z.number().int().nonnegative().optional(),
  taxablePaise: z.number().int(),
  cgstPaise: z.number().int(),
  sgstPaise: z.number().int(),
  igstPaise: z.number().int(),
  lineTotalPaise: z.number().int(),
});

const paymentSchema = z.object({
  id: z.string().min(1),
  method: z.enum(['cash', 'upi', 'card', 'credit']),
  amountPaise: z.number().int().positive(),
  paidAt: z.string(),
  reference: z.string().nullable(),
});

export const invoicePayloadSchema = z.object({
  id: z.string().min(1),
  invoiceNumber: z.string().min(1),
  financialYear: z.string().min(1),
  customerId: z.string().nullable(),
  customerSnapshot: snapshotSchema,
  placeOfSupplyStateCode: z.string().regex(/^[0-9]{2}$/),
  isInterState: z.boolean(),
  status: z.enum(['finalized', 'cancelled']),
  subtotalPaise: z.number().int(),
  discountPaise: z.number().int().nonnegative(),
  taxablePaise: z.number().int(),
  cgstPaise: z.number().int(),
  sgstPaise: z.number().int(),
  igstPaise: z.number().int(),
  roundOffPaise: z.number().int(),
  totalPaise: z.number().int(),
  paymentStatus: z.enum(['unpaid', 'partial', 'paid']),
  notes: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
  finalizedAt: z.string().nullable(),
  items: z.array(itemSchema).min(1),
  payments: z.array(paymentSchema).optional(),
});

export type InvoicePayload = z.infer<typeof invoicePayloadSchema>;
