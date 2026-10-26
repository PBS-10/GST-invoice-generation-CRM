import { Asset } from 'expo-asset';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { Platform } from 'react-native';
import fontAsset from '../../../assets/fonts/NotoSansMalayalam-Regular.ttf';
import { generateInvoicePDF, type InvoicePdfInput } from './generateInvoicePDF';

export async function shareInvoicePdf(input: InvoicePdfInput): Promise<void> {
  const pdf = await generateInvoicePDF(input, await loadInvoiceFontBytes());
  const filename = `${safeFileStem(input.invoice.invoiceNumber)}.pdf`;

  if (Platform.OS === 'web') {
    downloadOnWeb(pdf, filename);
    return;
  }

  const file = new File(Paths.cache, filename);
  if (file.exists) {
    file.delete();
  }
  file.create();
  file.write(pdf);

  if (!(await Sharing.isAvailableAsync())) {
    throw new Error('Sharing is not available on this device');
  }

  await Sharing.shareAsync(file.uri, {
    mimeType: 'application/pdf',
    UTI: 'com.adobe.pdf',
    dialogTitle: 'Share invoice',
  });
}

async function loadInvoiceFontBytes(): Promise<Uint8Array> {
  const asset = Asset.fromModule(fontAsset);
  if (!asset.downloaded) {
    await asset.downloadAsync();
  }
  const uri = asset.localUri ?? asset.uri;
  if (!uri) {
    throw new Error('Invoice font is missing from the app bundle');
  }
  if (uri.startsWith('file:') || uri.startsWith('/')) {
    return new File(uri).bytes();
  }
  const response = await fetch(uri);
  if (!response.ok) {
    throw new Error('Could not read the invoice font');
  }
  return new Uint8Array(await response.arrayBuffer());
}

function safeFileStem(invoiceNumber: string): string {
  const stem = invoiceNumber.replace(/[^\w.-]+/g, '-').replace(/^-+|-+$/g, '');
  return stem.length > 0 ? stem : 'invoice';
}

function downloadOnWeb(pdf: Uint8Array, filename: string): void {
  const documentRef = globalThis.document;
  if (!documentRef) {
    throw new Error('Could not download the PDF in this browser');
  }
  const copy = new Uint8Array(pdf.byteLength);
  copy.set(pdf);
  const blob = new Blob([copy], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  const anchor = documentRef.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}
