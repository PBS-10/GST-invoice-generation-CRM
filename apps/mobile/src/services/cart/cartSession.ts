import type { Repositories } from '../../database/repositories';
import { MAX_OPEN_CARTS } from '../../database/repositories/cartRepository';
import { store } from '../../store';
import { invoiceDraftActions, type InvoiceDraftState } from '../../store/slices/invoiceDraftSlice';

const PERSIST_DEBOUNCE_MS = 300;

let persistTimer: ReturnType<typeof setTimeout> | null = null;
let persistChain: Promise<void> = Promise.resolve();

function draftSlice(): InvoiceDraftState {
  return store.getState().invoiceDraft;
}

async function flushPersist(repos: Repositories): Promise<void> {
  const draft = draftSlice();
  if (!draft.activeCartId) {
    return;
  }
  await repos.carts.saveDraft(draft.activeCartId, draft);
}

export function schedulePersistActiveCart(repos: Repositories): void {
  if (persistTimer) {
    clearTimeout(persistTimer);
  }
  persistTimer = setTimeout(() => {
    persistTimer = null;
    persistChain = persistChain.then(() => flushPersist(repos)).catch(() => undefined);
  }, PERSIST_DEBOUNCE_MS);
}

export async function flushActiveCart(repos: Repositories): Promise<void> {
  if (persistTimer) {
    clearTimeout(persistTimer);
    persistTimer = null;
  }
  await persistChain;
  await flushPersist(repos);
}

function hydrateCart(cart: Awaited<ReturnType<Repositories['carts']['get']>>): void {
  if (!cart) {
    return;
  }
  store.dispatch(
    invoiceDraftActions.hydrateFromCart({
      cartId: cart.id,
      customerId: cart.customerId,
      customerSnapshot: cart.customerSnapshot,
      invoiceDiscountPaise: cart.invoiceDiscountPaise,
      notes: cart.notes ?? '',
      paymentMethod: cart.paymentMethod,
      collectPayment: cart.collectPayment,
      lines: cart.lines,
    }),
  );
}

export async function ensureActiveCart(repos: Repositories): Promise<string> {
  const metaId = await repos.appMeta.get('activeCartId');
  if (metaId) {
    const existing = await repos.carts.get(metaId);
    if (existing) {
      hydrateCart(existing);
      return existing.id;
    }
  }
  const draftId = draftSlice().activeCartId;
  if (draftId) {
    const existing = await repos.carts.get(draftId);
    if (existing) {
      await repos.appMeta.set('activeCartId', existing.id);
      hydrateCart(existing);
      return existing.id;
    }
  }
  const created = await repos.carts.create();
  await repos.appMeta.set('activeCartId', created.id);
  hydrateCart(created);
  return created.id;
}

export async function parkActiveAndStartNew(repos: Repositories): Promise<void> {
  await flushActiveCart(repos);
  const draft = draftSlice();
  if (draft.lines.length === 0) {
    throw new Error('Add items before parking a bill.');
  }
  const open = await repos.carts.countOpen();
  if (open >= MAX_OPEN_CARTS) {
    throw new Error(`You can park at most ${MAX_OPEN_CARTS} bills. Finish or discard one first.`);
  }
  const created = await repos.carts.create();
  await repos.appMeta.set('activeCartId', created.id);
  hydrateCart(created);
}

export async function resumeCart(repos: Repositories, cartId: string): Promise<void> {
  await flushActiveCart(repos);
  const cart = await repos.carts.get(cartId);
  if (!cart) {
    throw new Error('That parked bill was not found');
  }
  await repos.appMeta.set('activeCartId', cart.id);
  hydrateCart(cart);
}

export async function discardCart(repos: Repositories, cartId: string): Promise<void> {
  await flushActiveCart(repos);
  const editingId = await repos.appMeta.get('editingInvoiceId');
  const activeId = await repos.appMeta.get('activeCartId');
  await repos.carts.delete(cartId);
  if (editingId && activeId === cartId) {
    await repos.appMeta.delete('editingInvoiceId');
  }
  const active = draftSlice().activeCartId;
  if (active === cartId) {
    const remaining = await repos.carts.listOpen();
    if (remaining[0]) {
      await resumeCart(repos, remaining[0].id);
      return;
    }
    await repos.appMeta.delete('activeCartId');
    store.dispatch(invoiceDraftActions.resetDraft());
  }
}

export async function clearActiveCartAfterFinalize(repos: Repositories): Promise<void> {
  if (persistTimer) {
    clearTimeout(persistTimer);
    persistTimer = null;
  }
  const cartId = draftSlice().activeCartId ?? (await repos.appMeta.get('activeCartId'));
  if (cartId) {
    await repos.carts.delete(cartId);
  }
  await repos.appMeta.delete('activeCartId');
  await repos.appMeta.delete('editingInvoiceId');
  store.dispatch(invoiceDraftActions.resetDraft());
}

export async function openCartCount(repos: Repositories): Promise<number> {
  return repos.carts.countOpen();
}

/** Load an unpaid invoice into a cart so lines can be added/removed, then saved back. */
export async function startEditingUnpaidInvoice(
  repos: Repositories,
  invoiceId: string,
): Promise<void> {
  await flushActiveCart(repos);
  const invoice = await repos.invoices.getWithItems(invoiceId);
  if (!invoice) {
    throw new Error('Invoice not found');
  }
  if (invoice.status !== 'finalized') {
    throw new Error('Only saved invoices can be edited');
  }
  if (invoice.paymentStatus === 'paid') {
    throw new Error('Paid invoices cannot be edited. Cancel and create a new bill.');
  }

  const open = await repos.carts.countOpen();
  if (open >= MAX_OPEN_CARTS) {
    throw new Error(`You can park at most ${MAX_OPEN_CARTS} bills. Finish or discard one first.`);
  }

  const cart = await repos.carts.create({
    customerId: invoice.customerId,
    customerSnapshot: invoice.customerSnapshot,
  });
  const draft: InvoiceDraftState = {
    activeCartId: cart.id,
    customerId: invoice.customerId,
    customerSnapshot: invoice.customerSnapshot,
    invoiceDiscountPaise: invoice.discountPaise,
    notes: invoice.notes ?? '',
    paymentMethod: invoice.payments[0]?.method ?? 'cash',
    collectPayment: false,
    lines: invoice.items.map((item) => ({
      key: item.id,
      productId: item.productId,
      productName: item.productNameSnapshot,
      localName: item.localNameSnapshot,
      hsnCode: item.hsnSnapshot,
      unit: item.unitSnapshot,
      quantityMilli: item.quantityMilli,
      unitPricePaise: item.unitPricePaise,
      gstRateBps: item.gstRateBps,
      priceInclusive: item.priceInclusive,
      lineDiscountPaise: 0,
    })),
  };
  await repos.carts.saveDraft(cart.id, draft);
  await repos.appMeta.set('activeCartId', cart.id);
  await repos.appMeta.set('editingInvoiceId', invoiceId);
  hydrateCart({ ...cart, ...draft, lines: draft.lines, notes: draft.notes || null });
}

export async function getEditingInvoiceId(repos: Repositories): Promise<string | null> {
  return repos.appMeta.get('editingInvoiceId');
}

export async function clearEditingInvoiceId(repos: Repositories): Promise<void> {
  await repos.appMeta.delete('editingInvoiceId');
}

/**
 * Persist the active cart into parked bills and clear the active pointer so
 * the next New Invoice starts fresh. Does not create a replacement cart.
 */
export async function parkActiveAndLeave(repos: Repositories): Promise<void> {
  await flushActiveCart(repos);
  const draft = draftSlice();
  if (draft.lines.length === 0) {
    throw new Error('Add items before parking a bill.');
  }
  await repos.appMeta.delete('activeCartId');
  store.dispatch(invoiceDraftActions.resetDraft());
}

/** Delete the active cart (and clear unpaid-edit mode) then reset the draft. */
export async function discardActiveAndLeave(repos: Repositories): Promise<void> {
  await flushActiveCart(repos);
  const cartId = draftSlice().activeCartId ?? (await repos.appMeta.get('activeCartId'));
  if (cartId) {
    await repos.carts.delete(cartId);
  }
  await repos.appMeta.delete('activeCartId');
  await repos.appMeta.delete('editingInvoiceId');
  store.dispatch(invoiceDraftActions.resetDraft());
}
