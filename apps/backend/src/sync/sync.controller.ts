import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import type { AuthUser } from '../auth/auth.types';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { SyncService } from './sync.service';

@Controller('sync')
@UseGuards(JwtAuthGuard)
export class SyncController {
  constructor(private readonly sync: SyncService) {}

  @Post('push')
  push(@CurrentUser() user: AuthUser, @Body() body: unknown) {
    return this.sync.push(user.vendorId, user.deviceId, body);
  }

  @Post('pull')
  pull(@CurrentUser() user: AuthUser, @Body() body: unknown) {
    return this.sync.pull(user.vendorId, user.deviceId, body);
  }
}
