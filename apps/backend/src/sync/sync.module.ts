import { Module } from '@nestjs/common';
import { DevicesModule } from '../devices/devices.module';
import { InvoicesModule } from '../invoices/invoices.module';
import { SyncController } from './sync.controller';
import { SyncService } from './sync.service';

@Module({
  imports: [InvoicesModule, DevicesModule],
  controllers: [SyncController],
  providers: [SyncService],
})
export class SyncModule {}
