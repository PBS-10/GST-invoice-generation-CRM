import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { loadConfig } from '../config';
import { PrismaService } from '../prisma.service';
import type { AuthUser } from './auth.types';

type AccessPayload = {
  sub: string;
  vendorId: string;
  deviceId: string;
};

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private readonly prisma: PrismaService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: loadConfig().JWT_SECRET,
    });
  }

  async validate(payload: AccessPayload): Promise<AuthUser> {
    if (!payload.sub || !payload.vendorId || !payload.deviceId) {
      throw new UnauthorizedException('Invalid access token');
    }
    const device = await this.prisma.device.findUnique({ where: { id: payload.deviceId } });
    if (!device || device.vendorId !== payload.vendorId || device.userId !== payload.sub) {
      throw new UnauthorizedException('Invalid access token');
    }
    if (device.revokedAt) {
      throw new UnauthorizedException({ code: 'DEVICE_REVOKED', message: 'This device was signed out' });
    }
    await this.prisma.device.update({
      where: { id: device.id },
      data: { lastSeenAt: new Date() },
    });
    return {
      userId: payload.sub,
      vendorId: payload.vendorId,
      deviceId: payload.deviceId,
    };
  }
}
