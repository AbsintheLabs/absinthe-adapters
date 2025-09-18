// config/duration.ts
import z from 'zod';

/** Single-unit human duration → ms. Allowed: "2.5d", "1h", "45m", "3600s", "1000ms". */
export function parseHumanDurationToMs(input: string): number | null {
  const s = input.trim();
  const unitRe = /^(\d+(?:\.\d+)?)\s*(d|h|m|s|ms)$/i;
  const match = s.match(unitRe);
  if (!match) return null;

  const value = parseFloat(match[1]);
  const unit = match[2].toLowerCase();
  switch (unit) {
    case 'd':
      return Math.trunc(value * 24 * 60 * 60 * 1000);
    case 'h':
      return Math.trunc(value * 60 * 60 * 1000);
    case 'm':
      return Math.trunc(value * 60 * 1000);
    case 's':
      return Math.trunc(value * 1000);
    case 'ms':
      return Math.trunc(value);
    default:
      return null;
  }
}

/**
 * String in, number out.
 * - Validates the string shape
 * - Transforms to number (ms)
 * - Enforces min after transform
 */
export const durationHumanToMs = (minMs?: number) =>
  z
    .string()
    .superRefine((val, ctx) => {
      const ms = parseHumanDurationToMs(val);
      if (ms === null) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message:
            'Invalid duration. Use a single unit like "2.5d", "1h", "45m", "3600s", or "1000ms".',
        });
      }
    })
    .transform((val) => parseHumanDurationToMs(val)!) // now guaranteed non-null
    .superRefine((ms, ctx) => {
      const minAllowed = minMs ?? 3600000; // Always require at least 1 hour
      if (ms < minAllowed) {
        ctx.addIssue({
          code: z.ZodIssueCode.too_small,
          origin: 'string',
          type: 'number',
          inclusive: true,
          minimum: minAllowed,
          message: `Minimum is ${Math.floor(minAllowed / 3600000)}h.`,
        });
      }
      if (ms <= 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.too_small,
          origin: 'string',
          type: 'number',
          inclusive: false,
          minimum: 0,
          message: 'Must be > 0.',
        });
      }
    });
