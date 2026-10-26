import { requireOptionalNativeModule } from 'expo-modules-core';

export type BillingTranslateLang = 'hi' | 'ta';

export type DownloadModelOptions = {
  wifiOnly?: boolean;
};

type NativeBillingTranslate = {
  isAvailable(): boolean;
  isModelDownloaded(lang: string): Promise<boolean>;
  downloadModel(lang: string, wifiOnly: boolean): Promise<void>;
  deleteModel(lang: string): Promise<void>;
  getDownloadedModels(): Promise<string[]>;
  translate(text: string, sourceLang: string, targetLang: string): Promise<string>;
};

const NativeModule =
  requireOptionalNativeModule<NativeBillingTranslate>('BillingTranslate');

export function isAvailable(): boolean {
  try {
    return NativeModule?.isAvailable() ?? false;
  } catch {
    return false;
  }
}

export async function isModelDownloaded(lang: BillingTranslateLang): Promise<boolean> {
  if (!NativeModule) {
    return false;
  }
  return NativeModule.isModelDownloaded(lang);
}

export async function downloadModel(
  lang: BillingTranslateLang,
  options: DownloadModelOptions = {},
): Promise<void> {
  if (!NativeModule) {
    throw new Error('On-device translation needs a development build (not Expo Go).');
  }
  await NativeModule.downloadModel(lang, options.wifiOnly !== false);
}

export async function deleteModel(lang: BillingTranslateLang): Promise<void> {
  if (!NativeModule) {
    throw new Error('On-device translation needs a development build (not Expo Go).');
  }
  await NativeModule.deleteModel(lang);
}

export async function getDownloadedModels(): Promise<string[]> {
  if (!NativeModule) {
    return [];
  }
  return NativeModule.getDownloadedModels();
}

export async function translate(
  text: string,
  sourceLang: BillingTranslateLang,
  targetLang = 'en',
): Promise<string> {
  if (!NativeModule) {
    throw new Error('On-device translation needs a development build (not Expo Go).');
  }
  return NativeModule.translate(text, sourceLang, targetLang);
}
