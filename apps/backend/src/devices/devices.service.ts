import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';

@Injectable()
export class DevicesService {
  constructor(private readonly prisma: PrismaService) {}

  async list(vendorId: string, currentDeviceId: string) {
    const devices = await this.prisma.device.findMany({
      where: { vendorId },
      orderBy: { createdAt: 'asc' },
    });
    return devices.map((device) => ({
      id: device.id,
      label: device.label,
      platform: device.platform,
      appVersion: device.appVersion,
      seriesCode: device.seriesCode,
      createdAt: device.createdAt.toISOString(),
      lastSeenAt: device.lastSeenAt.toISOString(),
      lastSyncAt: device.lastSyncAt?.toISOString() ?? null,
      revokedAt: device.revokedAt?.toISOString() ?? null,
      isCurrent: device.id === currentDeviceId,
    }));
  }

  async revoke(vendorId: string, userId: string, deviceId: string, currentDeviceId: string) {
    if (deviceId === currentDeviceId) {
      throw new ForbiddenException('Sign out this phone from Settings instead of removing it here');
    }
    const device = await this.prisma.device.findFirst({ where: { id: deviceId, vendorId } });
    if (!device) {
      throw new NotFoundException('Device not found');
    }
    if (device.revokedAt) {
      return { ok: true as const };
    }
    const now = new Date();
    await this.prisma.$transaction([
      this.prisma.device.update({
        where: { id: deviceId },
        data: { revokedAt: now },
      }),
      this.prisma.refreshToken.updateMany({
        where: { deviceId, userId, revokedAt: null },
        data: { revokedAt: now },
      }),
    ]);
    return { ok: true as const };
  }

  async touchSync(deviceId: string) {
    await this.prisma.device.update({
      where: { id: deviceId },
      data: { lastSyncAt: new Date(), lastSeenAt: new Date() },
    });
  }
}
