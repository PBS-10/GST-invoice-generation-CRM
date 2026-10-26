import type { AppDatabase } from './client';
import { createProductRepository } from './repositories/productRepository';
import { createVendorRepository } from './repositories/vendorRepository';

export async function seedIfEmpty(db: AppDatabase): Promise<void> {
  const vendors = createVendorRepository(db);
  const existing = await vendors.get();
  if (existing) {
    return;
  }

  const vendor = await vendors.upsert({
    businessName: 'My Shop',
    tradeName: '',
    gstin: null,
    phone: null,
    email: null,
    addressLine1: null,
    addressLine2: null,
    city: null,
    stateCode: '32',
    pincode: null,
    gstRegistrationType: 'regular',
    invoicePrefix: 'INV',
  });

  const products = createProductRepository(db);
  await products.create({
    name: 'Rice',
    localName: 'Ari',
    aliases: ['rice', 'ari'],
    sku: null,
    hsnCode: '1006',
    unit: 'kg',
    sellingPricePaise: 5000,
    gstRateBps: 500,
    priceInclusive: false,
    isActive: true,
  });

  void vendor;
}
