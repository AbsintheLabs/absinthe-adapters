// redis/ts-util.ts
import type { Redis } from 'ioredis';

export const withPrefix = (redis: Redis, key: string): string => {
  const prefix = (redis as any)?.options?.keyPrefix ?? '';
  return prefix && !key.startsWith(prefix) ? prefix + key : key;
};
