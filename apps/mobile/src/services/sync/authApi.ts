import type { Repositories } from '../../database/repositories';
import { apiRequest } from './apiClient';
import { buildDevicePayload } from './deviceInfo';
import { clearTokens, saveTokens } from './tokenStore';

type AuthResponse = {
  accessToken: string;
  refreshToken: string;
  vendorId: string;
  device: { id: string; seriesCode: string };
};

export async function registerAccount(
  repos: Repositories,
  input: { email: string; password: string },
): Promise<AuthResponse> {
  const vendor = await repos.vendors.get();
  if (!vendor) {
    throw new Error('Set up your shop profile before creating a backup account');
  }
  const gst = await repos.vendors.getGstConfig(vendor.id);
  if (!gst) {
    throw new Error('Shop GST settings are missing');
  }
  const device = await buildDevicePayload(repos.appMeta);
  const response = await apiRequest<AuthResponse>('/auth/register', {
    auth: false,
    body: {
      email: input.email,
      password: input.password,
      device,
      vendor: {
        id: vendor.id,
        businessName: vendor.businessName,
        tradeName: vendor.tradeName,
        gstin: vendor.gstin,
        phone: vendor.phone,
        email: vendor.email,
        addressLine1: vendor.addressLine1,
        addressLine2: vendor.addressLine2,
        city: vendor.city,
        stateCode: vendor.stateCode,
        pincode: vendor.pincode,
        gstRegistrationType: vendor.gstRegistrationType,
        invoicePrefix: vendor.invoicePrefix.slice(0, 3),
        createdAt: vendor.createdAt,
        updatedAt: vendor.updatedAt,
      },
      gstConfiguration: {
        id: gst.id,
        defaultGstRateBps: gst.defaultGstRateBps,
        enableIgst: gst.enableIgst,
        roundingMode: gst.roundingMode,
        compositionScheme: gst.compositionScheme,
        createdAt: gst.createdAt,
        updatedAt: gst.updatedAt,
      },
    },
  });
  await persistAuth(repos, input.email, response);
  return response;
}

export async function loginAccount(
  repos: Repositories,
  input: { email: string; password: string },
): Promise<AuthResponse> {
  const device = await buildDevicePayload(repos.appMeta);
  const response = await apiRequest<AuthResponse>('/auth/login', {
    auth: false,
    body: {
      email: input.email,
      password: input.password,
      device,
    },
  });
  await persistAuth(repos, input.email, response);
  return response;
}

export async function logoutAccount(repos: Repositories): Promise<void> {
  const deviceId = await repos.appMeta.get('deviceId');
  try {
    if (deviceId) {
      await apiRequest('/auth/logout', { method: 'POST', deviceId, body: {} });
    }
  } catch {
    // local sign-out still proceeds
  }
  await clearTokens();
  await repos.appMeta.delete('accountEmail');
  await repos.appMeta.delete('linkedVendorId');
}

async function persistAuth(repos: Repositories, email: string, response: AuthResponse) {
  await saveTokens(response.accessToken, response.refreshToken);
  await repos.appMeta.set('accountEmail', email.toLowerCase());
  await repos.appMeta.set('linkedVendorId', response.vendorId);
  await repos.appMeta.set('deviceId', response.device.id);
  await repos.appMeta.set('seriesCode', response.device.seriesCode);
}
