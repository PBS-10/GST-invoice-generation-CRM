import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import {
  authLoginSchema,
  authRefreshSchema,
  authRegisterSchema,
  type DevicePayload,
} from '@invoice-gst/validation';
import bcrypt from 'bcryptjs';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { loadConfig } from '../config';
import { PrismaService } from '../prisma.service';
import { nextServerVersion } from '../sync/serverVersion';
import type { AuthTokensResponse } from './auth.types';
import { nextSeriesCode } from './series';

const ACCESS_TTL = '15m';
const REFRESH_TTL_MS = 30 * 24 * 60 * 60 * 1000;

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {}

  async register(body: unknown): Promise<AuthTokensResponse> {
    const input = authRegisterSchema.parse(body);
    const email = input.email.toLowerCase();
    const existingEmail = await this.prisma.user.findUnique({ where: { email } });
    if (existingEmail) {
      throw new ConflictException('An account with this email already exists');
    }
    const existingVendor = await this.prisma.vendor.findUnique({ where: { id: input.vendor.id } });
    if (existingVendor) {
      throw new ConflictException({
        code: 'VENDOR_EXISTS',
        message: 'This shop is already linked to a cloud account',
      });
    }

    const now = new Date();
    const userId = randomUUID();
    const passwordHash = await bcrypt.hash(input.password, 12);
    const vendorVersion = await nextServerVersion(this.prisma);
    const gstVersion = await nextServerVersion(this.prisma);

    await this.prisma.$transaction(async (tx) => {
      await tx.vendor.create({
        data: {
          id: input.vendor.id,
          businessName: input.vendor.businessName,
          tradeName: input.vendor.tradeName || null,
          gstin: input.vendor.gstin || null,
          phone: input.vendor.phone || null,
          email: input.vendor.email || null,
          addressLine1: input.vendor.addressLine1 || null,
          addressLine2: input.vendor.addressLine2 || null,
          city: input.vendor.city || null,
          stateCode: input.vendor.stateCode,
          pincode: input.vendor.pincode || null,
          gstRegistrationType: input.vendor.gstRegistrationType,
          invoicePrefix: input.vendor.invoicePrefix.toUpperCase(),
          logoUri: null,
          createdAt: new Date(input.vendor.createdAt),
          updatedAt: new Date(input.vendor.updatedAt),
          serverVersion: vendorVersion,
        },
      });
      await tx.gstConfiguration.create({
        data: {
          id: input.gstConfiguration.id,
          vendorId: input.vendor.id,
          defaultGstRateBps: input.gstConfiguration.defaultGstRateBps,
          enableIgst: input.gstConfiguration.enableIgst,
          roundingMode: input.gstConfiguration.roundingMode,
          compositionScheme: input.gstConfiguration.compositionScheme,
          createdAt: new Date(input.gstConfiguration.createdAt),
          updatedAt: new Date(input.gstConfiguration.updatedAt),
          serverVersion: gstVersion,
        },
      });
      await tx.user.create({
        data: {
          id: userId,
          email,
          passwordHash,
          vendorId: input.vendor.id,
          createdAt: now,
          updatedAt: now,
        },
      });
      await tx.device.create({
        data: {
          id: input.device.id,
          vendorId: input.vendor.id,
          userId,
          label: input.device.label,
          platform: input.device.platform,
          appVersion: input.device.appVersion ?? null,
          seriesCode: 'A',
          createdAt: now,
          lastSeenAt: now,
        },
      });
    });

    return this.issueTokens(userId, input.vendor.id, input.device.id, 'A');
  }

  async login(body: unknown): Promise<AuthTokensResponse> {
    const input = authLoginSchema.parse(body);
    const user = await this.prisma.user.findUnique({
      where: { email: input.email.toLowerCase() },
    });
    if (!user || !(await bcrypt.compare(input.password, user.passwordHash))) {
      throw new UnauthorizedException('Email or password is wrong');
    }

    const device = await this.upsertDevice(user.id, user.vendorId, input.device);
    return this.issueTokens(user.id, user.vendorId, device.id, device.seriesCode);
  }

  async refresh(body: unknown): Promise<AuthTokensResponse> {
    const input = authRefreshSchema.parse(body);
    const tokenHash = hashToken(input.refreshToken);
    const stored = await this.prisma.refreshToken.findUnique({
      where: { tokenHash },
      include: { device: true },
    });
    if (!stored || stored.deviceId !== input.deviceId) {
      throw new UnauthorizedException('Refresh token is not valid');
    }
    if (stored.revokedAt || stored.expiresAt.getTime() <= Date.now()) {
      if (stored.replacedById) {
        await this.revokeDeviceSessions(stored.deviceId);
      }
      throw new UnauthorizedException('Refresh token is not valid');
    }
    if (stored.device.revokedAt) {
      throw new UnauthorizedException({ code: 'DEVICE_REVOKED', message: 'This device was signed out' });
    }
    const user = await this.prisma.user.findUnique({ where: { id: stored.userId } });
    if (!user) {
      throw new UnauthorizedException('Refresh token is not valid');
    }

    const next = await this.issueTokens(user.id, user.vendorId, stored.deviceId, stored.device.seriesCode);
    await this.prisma.refreshToken.update({
      where: { id: stored.id },
      data: {
        revokedAt: new Date(),
        replacedById: hashToken(next.refreshToken),
      },
    });
    return next;
  }

  async logout(userId: string, deviceId: string): Promise<{ ok: true }> {
    await this.revokeDeviceSessions(deviceId, userId);
    return { ok: true };
  }

  private async upsertDevice(userId: string, vendorId: string, device: DevicePayload) {
    const existing = await this.prisma.device.findUnique({ where: { id: device.id } });
    const now = new Date();
    if (existing) {
      if (existing.vendorId !== vendorId || existing.userId !== userId) {
        throw new ConflictException('This device is already linked to another shop');
      }
      if (existing.revokedAt) {
        throw new UnauthorizedException({ code: 'DEVICE_REVOKED', message: 'This device was signed out' });
      }
      return this.prisma.device.update({
        where: { id: existing.id },
        data: {
          label: device.label,
          platform: device.platform,
          appVersion: device.appVersion ?? null,
          lastSeenAt: now,
        },
      });
    }

    const used = await this.prisma.device.findMany({
      where: { vendorId },
      select: { seriesCode: true },
    });
    const seriesCode = nextSeriesCode(used.map((row) => row.seriesCode));
    return this.prisma.device.create({
      data: {
        id: device.id,
        vendorId,
        userId,
        label: device.label,
        platform: device.platform,
        appVersion: device.appVersion ?? null,
        seriesCode,
        createdAt: now,
        lastSeenAt: now,
      },
    });
  }

  private async issueTokens(
    userId: string,
    vendorId: string,
    deviceId: string,
    seriesCode: string,
  ): Promise<AuthTokensResponse> {
    const config = loadConfig();
    const accessToken = await this.jwt.signAsync(
      { sub: userId, vendorId, deviceId },
      { secret: config.JWT_SECRET, expiresIn: ACCESS_TTL },
    );
    const refreshToken = randomBytes(32).toString('hex');
    const now = new Date();
    await this.prisma.refreshToken.create({
      data: {
        id: randomUUID(),
        userId,
        deviceId,
        tokenHash: hashToken(refreshToken),
        expiresAt: new Date(now.getTime() + REFRESH_TTL_MS),
        createdAt: now,
      },
    });
    await this.prisma.device.update({
      where: { id: deviceId },
      data: { lastSeenAt: now },
    });
    return {
      accessToken,
      refreshToken,
      vendorId,
      device: { id: deviceId, seriesCode },
    };
  }

  private async revokeDeviceSessions(deviceId: string, userId?: string) {
    await this.prisma.refreshToken.updateMany({
      where: {
        deviceId,
        ...(userId ? { userId } : {}),
        revokedAt: null,
      },
      data: { revokedAt: new Date() },
    });
  }
}

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}
