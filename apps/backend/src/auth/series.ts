import { ConflictException } from '@nestjs/common';
import { SERIES_CODES } from '../config';

export function nextSeriesCode(used: readonly string[]): string {
  const taken = new Set(used);
  for (const code of SERIES_CODES) {
    if (!taken.has(code)) {
      return code;
    }
  }
  throw new ConflictException({ code: 'DEVICE_LIMIT', message: 'This shop already has the maximum number of devices' });
}
