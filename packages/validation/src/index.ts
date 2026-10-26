import { z } from 'zod';

const gstinSchema = z.union([
  z.literal(''),
  z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/, 'Invalid GSTIN'),
]);

const invoicePrefixSchema = z
  .string()
  .trim()
  .min(1, 'Invoice prefix is required')
  .max(3, 'Invoice prefix must be 1–3 characters')
  .regex(/^[A-Za-z0-9]+$/, 'Prefix must be alphanumeric');

export const vendorFormSchema = z.object({
  businessName: z.string().trim().min(1, 'Business name is required'),
  tradeName: z.string().trim().optional().or(z.literal('')),
  gstin: gstinSchema,
  phone: z.string().trim().optional().or(z.literal('')),
  email: z.union([z.literal(''), z.string().trim().email('Invalid email')]),
  addressLine1: z.string().trim().optional().or(z.literal('')),
  addressLine2: z.string().trim().optional().or(z.literal('')),
  city: z.string().trim().optional().or(z.literal('')),
  stateCode: z.string().regex(/^[0-9]{2}$/, 'State code must be 2 digits'),
  pincode: z.string().trim().optional().or(z.literal('')),
  gstRegistrationType: z.enum(['regular', 'composition', 'unregistered']),
  invoicePrefix: invoicePrefixSchema,
});

export const customerFormSchema = z.object({
  name: z.string().trim().min(1, 'Name is required'),
  phone: z.string().trim().optional().or(z.literal('')),
  email: z.union([z.literal(''), z.string().trim().email('Invalid email')]),
  addressLine1: z.string().trim().optional().or(z.literal('')),
  city: z.string().trim().optional().or(z.literal('')),
  stateCode: z.union([
    z.literal(''),
    z.string().regex(/^[0-9]{2}$/, 'State code must be 2 digits'),
  ]),
  pincode: z.string().trim().optional().or(z.literal('')),
  gstin: gstinSchema,
  customerType: z.enum(['b2c', 'b2b', 'unregistered']),
});

export const productFormSchema = z.object({
  name: z.string().trim().min(1, 'Name is required'),
  localName: z.string().trim().optional().or(z.literal('')),
  aliasesText: z.string().optional().or(z.literal('')),
  sku: z.string().trim().optional().or(z.literal('')),
  hsnCode: z.string().trim().optional().or(z.literal('')),
  unit: z.enum(['kg', 'g', 'l', 'ml', 'pcs', 'packet', 'other']),
  sellingPriceRupees: z
    .string()
    .trim()
    .refine((value) => /^\d+(\.\d{1,2})?$/.test(value) && Number(value) >= 0, {
      message: 'Enter a valid price',
    }),
  gstRatePercent: z.enum(['0', '5', '12', '18', '28']),
  priceInclusive: z.boolean(),
  isActive: z.boolean(),
});

export const devicePayloadSchema = z.object({
  id: z.string().uuid(),
  label: z.string().trim().min(1).max(80),
  platform: z.enum(['android', 'ios', 'web']),
  appVersion: z.string().trim().max(40).optional().nullable(),
});

export const authRegisterSchema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(8).max(72),
  device: devicePayloadSchema,
  vendor: z.object({
    id: z.string().uuid(),
    businessName: z.string().trim().min(1),
    tradeName: z.string().trim().optional().nullable(),
    gstin: z.string().trim().optional().nullable(),
    phone: z.string().trim().optional().nullable(),
    email: z.string().trim().optional().nullable(),
    addressLine1: z.string().trim().optional().nullable(),
    addressLine2: z.string().trim().optional().nullable(),
    city: z.string().trim().optional().nullable(),
    stateCode: z.string().regex(/^[0-9]{2}$/),
    pincode: z.string().trim().optional().nullable(),
    gstRegistrationType: z.enum(['regular', 'composition', 'unregistered']),
    invoicePrefix: invoicePrefixSchema,
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
  }),
  gstConfiguration: z.object({
    id: z.string().uuid(),
    defaultGstRateBps: z.number().int().nonnegative(),
    enableIgst: z.boolean(),
    roundingMode: z.enum(['nearest', 'up', 'down']),
    compositionScheme: z.boolean(),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
  }),
});

export const authLoginSchema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(1),
  device: devicePayloadSchema,
});

export const authRefreshSchema = z.object({
  refreshToken: z.string().min(20),
  deviceId: z.string().uuid(),
});

export const syncEntityTypeSchema = z.enum([
  'vendor',
  'gst_configuration',
  'product',
  'customer',
  'invoice',
]);

export const syncChangeSchema = z.object({
  idempotencyKey: z.string().min(1),
  entityType: syncEntityTypeSchema,
  entityId: z.string().min(1),
  operation: z.enum(['create', 'update', 'delete']),
  clientUpdatedAt: z.string(),
  payload: z.unknown(),
});

export const syncPushSchema = z.object({
  changes: z.array(syncChangeSchema).max(100),
});

export const syncPullSchema = z.object({
  cursor: z.union([z.string(), z.number()]).optional().nullable(),
  limit: z.number().int().min(1).max(200).optional(),
});

export type VendorFormValues = z.infer<typeof vendorFormSchema>;
export type CustomerFormValues = z.infer<typeof customerFormSchema>;
export type ProductFormValues = z.infer<typeof productFormSchema>;
export type DevicePayload = z.infer<typeof devicePayloadSchema>;
export type AuthRegisterInput = z.infer<typeof authRegisterSchema>;
export type AuthLoginInput = z.infer<typeof authLoginSchema>;
export type SyncPushInput = z.infer<typeof syncPushSchema>;
export type SyncChange = z.infer<typeof syncChangeSchema>;

export function parseAliases(aliasesText: string | undefined): string[] {
  if (!aliasesText) {
    return [];
  }
  return aliasesText
    .split(',')
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
}
