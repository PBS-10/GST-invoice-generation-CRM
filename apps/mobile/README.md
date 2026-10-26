# GST Invoice — mobile

Expo (dev client) app for shop billing. Native modules require a custom build — **Expo Go is not supported** for speech or on-device translate.

## Voice translate (ML Kit)

Final voice lines in **Hindi** or **Tamil** are translated on-device to English before catalogue match. **Malayalam** is not supported by Google ML Kit Translate; matching uses the spoken text and learns aliases when the clerk resolves a miss.

1. Rebuild after pulling this module:

   ```bash
   npx expo run:android
   # or
   npx expo run:ios
   ```

2. Open **Settings → Voice language packs** and download Hindi / Tamil (~30 MB each, Wi‑Fi preferred).

3. On New Invoice, pick HI or TA, then speak. Without the pack, billing still works on the spoken text (resolve sheet + auto-alias).

Local module: [`modules/billing-translate`](./modules/billing-translate).

### Manual QA

- HI + pack ready: speak a Hindi product line → matches English catalogue name.
- HI + pack missing: toast once; resolve → alias saved → second try matches.
- TA: same as HI.
- ML: no translate; resolve once → alias → next match.
- EN: unchanged (no translate).
- Airplane mode after packs downloaded: HI/TA still translate.
- Rebuild with `expo run:android` / `expo run:ios` (physical iOS device preferred for ML Kit).
