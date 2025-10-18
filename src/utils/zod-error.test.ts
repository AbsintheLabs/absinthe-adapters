import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import { formatZodError, catchZodError, catchZodErrorAsync } from './zod-error.ts';

describe('formatZodError', () => {
  it('should format a simple validation error', () => {
    const schema = z.object({
      name: z.string(),
      age: z.number(),
    });

    try {
      schema.parse({ name: 123, age: 'not a number' });
    } catch (error) {
      if (error instanceof z.ZodError) {
        const formatted = formatZodError(error);
        expect(formatted).toContain('✖');
        expect(formatted).toContain('name');
        expect(formatted).toContain('age');
      }
    }
  });

  it('should include context when provided', () => {
    const schema = z.string();

    try {
      schema.parse(123);
    } catch (error) {
      if (error instanceof z.ZodError) {
        const formatted = formatZodError(error, { input: 123, source: 'test' });
        expect(formatted).toContain('Context');
        expect(formatted).toContain('input');
        expect(formatted).toContain('123');
      }
    }
  });

  it('should handle nested object errors', () => {
    const schema = z.object({
      user: z.object({
        profile: z.object({
          email: z.string().email(),
        }),
      }),
    });

    try {
      schema.parse({ user: { profile: { email: 'invalid-email' } } });
    } catch (error) {
      if (error instanceof z.ZodError) {
        const formatted = formatZodError(error);
        expect(formatted).toContain('email');
      }
    }
  });
});

describe('catchZodError', () => {
  it('should catch and format Zod errors', () => {
    const schema = z.string();

    expect(() => {
      catchZodError(() => schema.parse(123));
    }).toThrow(/✖/);
  });

  it('should pass through non-Zod errors', () => {
    expect(() => {
      catchZodError(() => {
        throw new Error('Not a Zod error');
      });
    }).toThrow('Not a Zod error');
  });

  it('should include context in the error message', () => {
    const schema = z.string();

    expect(() => {
      catchZodError(() => schema.parse(123), { attemptNumber: 1 });
    }).toThrow(/Context/);
  });
});

describe('catchZodErrorAsync', () => {
  it('should catch and format async Zod errors', async () => {
    const schema = z.string();

    await expect(catchZodErrorAsync(async () => schema.parse(123))).rejects.toThrow(/✖/);
  });

  it('should pass through non-Zod errors', async () => {
    await expect(
      catchZodErrorAsync(async () => {
        throw new Error('Not a Zod error');
      }),
    ).rejects.toThrow('Not a Zod error');
  });

  it('should include context in the error message', async () => {
    const schema = z.string();

    await expect(
      catchZodErrorAsync(async () => schema.parse(123), { attemptNumber: 1 }),
    ).rejects.toThrow(/Context/);
  });
});
