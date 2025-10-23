import { z } from 'zod';

/**
 * Pretty prints a Zod error using the built-in prettifyError function in Zod v4.
 * Optionally includes context information for debugging.
 *
 * @param error - The ZodError to format
 * @param context - Optional context object to include in the error message
 * @returns A formatted, user-friendly error string
 */
export function formatZodError(error: z.ZodError, context?: Record<string, unknown>): string {
  const prettyError = z.prettifyError(error);

  if (context) {
    const contextStr = JSON.stringify(
      context,
      (key, value) => (typeof value === 'bigint' ? value.toString() : value),
      2,
    );
    return `${prettyError}\n\nContext:\n${contextStr}`;
  }

  return prettyError;
}

/**
 * Wraps a function that might throw a ZodError and converts it to a pretty error.
 * Useful for catching and re-throwing Zod errors with better formatting.
 *
 * @param fn - Function that might throw a ZodError
 * @param context - Optional context to include in error messages
 * @returns The result of the function
 * @throws Error with pretty-printed Zod error message
 */
export function catchZodError<T>(fn: () => T, context?: Record<string, unknown>): T {
  try {
    return fn();
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new Error(formatZodError(error, context));
    }
    throw error;
  }
}

/**
 * Async version of catchZodError
 */
export async function catchZodErrorAsync<T>(
  fn: () => Promise<T>,
  context?: Record<string, unknown>,
): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new Error(formatZodError(error, context));
    }
    throw error;
  }
}
