import { describe, expect, it } from 'vitest';
import {
  isPrinterConfigured,
  UnsupportedPrinterError,
  unsupportedPrinterPort,
} from './PrinterPort';

describe('PrinterPort stub', () => {
  it('reports that no printer is configured yet', () => {
    expect(isPrinterConfigured()).toBe(false);
  });

  it('rejects print until a hardware adapter is wired', async () => {
    await expect(unsupportedPrinterPort.printInvoice({} as never)).rejects.toBeInstanceOf(
      UnsupportedPrinterError,
    );
  });
});
