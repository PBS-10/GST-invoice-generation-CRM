import type { AppDatabase } from '../client';
import { createAppMetaRepository } from './appMetaRepository';
import { createCartRepository } from './cartRepository';
import { createCustomerRepository } from './customerRepository';
import { createInvoiceRepository } from './invoiceRepository';
import { createProductRepository } from './productRepository';
import { createSyncQueueRepository } from './syncQueueRepository';
import { createVendorRepository } from './vendorRepository';

export function createRepositories(db: AppDatabase) {
  return {
    vendors: createVendorRepository(db),
    customers: createCustomerRepository(db),
    products: createProductRepository(db),
    invoices: createInvoiceRepository(db),
    carts: createCartRepository(db),
    syncQueue: createSyncQueueRepository(db),
    appMeta: createAppMetaRepository(db),
  };
}

export type Repositories = ReturnType<typeof createRepositories>;
