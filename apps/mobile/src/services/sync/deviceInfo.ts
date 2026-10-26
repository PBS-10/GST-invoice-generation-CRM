import type { DevicePayload } from '@invoice-gst/validation';
import { Platform } from 'react-native';
import type { AppMetaRepository } from '../../database/repositories/appMetaRepository';

export async function buildDevicePayload(appMeta: AppMetaRepository): Promise<DevicePayload> {
  const id = await appMeta.ensureDeviceId();
  const platform = Platform.OS === 'ios' ? 'ios' : Platform.OS === 'android' ? 'android' : 'web';
  return {
    id,
    label: Platform.select({
      ios: 'iPhone',
      android: 'Android phone',
      default: 'Web browser',
    }) as string,
    platform,
    appVersion: '0.1.0',
  };
}
