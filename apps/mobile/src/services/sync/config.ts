export function getApiBaseUrl(): string | null {
  const value = process.env.EXPO_PUBLIC_API_URL?.trim();
  if (!value) {
    return null;
  }
  return value.replace(/\/$/, '');
}

export function isCloudBackupEnabled(): boolean {
  return getApiBaseUrl() != null;
}
