export type AuthUser = {
  userId: string;
  vendorId: string;
  deviceId: string;
};

export type AuthTokensResponse = {
  accessToken: string;
  refreshToken: string;
  vendorId: string;
  device: {
    id: string;
    seriesCode: string;
  };
};
