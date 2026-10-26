import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AuthModule } from './auth/auth.module';
import { DevicesModule } from './devices/devices.module';
import { HealthController } from './health/health.controller';
import { InvoicesModule } from './invoices/invoices.module';
import { PrismaModule } from './prisma.module';
import { SyncModule } from './sync/sync.module';

@Module({
  imports: [
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 120 }]),
    PrismaModule,
    AuthModule,
    DevicesModule,
    InvoicesModule,
    SyncModule,
  ],
  controllers: [HealthController],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
