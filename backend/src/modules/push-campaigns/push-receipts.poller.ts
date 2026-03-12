import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PushCampaignsService } from './push-campaigns.service';

@Injectable()
export class PushReceiptsPoller implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PushReceiptsPoller.name);
  private timer: NodeJS.Timeout | null = null;

  constructor(
    private readonly service: PushCampaignsService,
    private readonly config: ConfigService,
  ) {}

  onModuleInit() {
    const enabled = this.config.get<string>('PUSH_RECEIPTS_POLL_ENABLED', 'true') === 'true';
    if (!enabled) return;

    const intervalMs = Number(this.config.get<string>('PUSH_RECEIPTS_POLL_INTERVAL_MS') ?? '30000');
    if (!intervalMs || intervalMs < 5_000) {
      this.logger.warn('PUSH_RECEIPTS_POLL_INTERVAL_MS too low or invalid; skipping poller');
      return;
    }

    this.timer = setInterval(() => {
      void this.service.pollReceiptsOnce().catch((e) => {
        this.logger.warn(`Receipt poll failed: ${e?.message ?? e}`);
      });
    }, intervalMs);
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }
}

