import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  setBillingTranslateForTests,
  type BillingTranslateApi,
} from './billingTranslateNative';
import {
  clearBillingTranscriptCache,
  prepareBillingTranscript,
} from './prepareBillingTranscript';

function fakeApi(partial: Partial<BillingTranslateApi>): BillingTranslateApi {
  return {
    isAvailable: () => true,
    isModelDownloaded: vi.fn(async () => false),
    downloadModel: vi.fn(async () => undefined),
    deleteModel: vi.fn(async () => undefined),
    getDownloadedModels: vi.fn(async () => []),
    translate: vi.fn(async (text: string) => text),
    ...partial,
  };
}

describe('prepareBillingTranscript', () => {
  beforeEach(() => {
    clearBillingTranscriptCache();
    setBillingTranslateForTests(undefined);
  });

  afterEach(() => {
    clearBillingTranscriptCache();
    setBillingTranslateForTests(undefined);
  });

  it('skips translate for English', async () => {
    const translate = vi.fn();
    setBillingTranslateForTests(fakeApi({ translate }));
    const result = await prepareBillingTranscript('2 kg rice', 'en-IN');
    expect(result).toEqual({
      text: '2 kg rice',
      translated: false,
      modelMissing: false,
      sourceLang: null,
    });
    expect(translate).not.toHaveBeenCalled();
  });

  it('skips translate for Malayalam (unsupported by ML Kit)', async () => {
    const translate = vi.fn();
    setBillingTranslateForTests(fakeApi({ translate }));
    const result = await prepareBillingTranscript('രണ്ട് കിലോ അരി', 'ml-IN');
    expect(result.sourceLang).toBeNull();
    expect(result.translated).toBe(false);
    expect(translate).not.toHaveBeenCalled();
  });

  it('falls back when Hindi pack is missing', async () => {
    const translate = vi.fn();
    setBillingTranslateForTests(
      fakeApi({
        isModelDownloaded: vi.fn(async () => false),
        translate,
      }),
    );
    const result = await prepareBillingTranscript('दो किलो चावल', 'hi-IN');
    expect(result).toMatchObject({
      text: 'दो किलो चावल',
      translated: false,
      modelMissing: true,
      sourceLang: 'hi',
    });
    expect(translate).not.toHaveBeenCalled();
  });

  it('translates Hindi when the pack is ready', async () => {
    const translate = vi.fn(async () => '2 kg rice');
    setBillingTranslateForTests(
      fakeApi({
        isModelDownloaded: vi.fn(async () => true),
        translate,
      }),
    );
    const result = await prepareBillingTranscript('दो किलो चावल', 'hi-IN');
    expect(result).toEqual({
      text: '2 kg rice',
      translated: true,
      modelMissing: false,
      sourceLang: 'hi',
    });
    expect(translate).toHaveBeenCalledWith('दो किलो चावल', 'hi', 'en');
  });

  it('caches successful translations in-session', async () => {
    const translate = vi.fn(async () => 'rice');
    setBillingTranslateForTests(
      fakeApi({
        isModelDownloaded: vi.fn(async () => true),
        translate,
      }),
    );
    await prepareBillingTranscript('चावल', 'hi-IN');
    await prepareBillingTranscript('चावल', 'hi-IN');
    expect(translate).toHaveBeenCalledTimes(1);
  });

  it('falls back to original text when translate throws', async () => {
    setBillingTranslateForTests(
      fakeApi({
        isModelDownloaded: vi.fn(async () => true),
        translate: vi.fn(async () => {
          throw new Error('native fail');
        }),
      }),
    );
    const result = await prepareBillingTranscript('चावल', 'hi-IN');
    expect(result.text).toBe('चावल');
    expect(result.translated).toBe(false);
  });

  it('treats missing native module as modelMissing', async () => {
    setBillingTranslateForTests(null);
    const result = await prepareBillingTranscript('चावल', 'hi-IN');
    expect(result.modelMissing).toBe(true);
    expect(result.text).toBe('चावल');
  });
});
