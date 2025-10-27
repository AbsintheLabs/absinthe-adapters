// config/load.ts
import { readFileSync, existsSync } from 'fs';
import { join, isAbsolute } from 'path';
import { z } from 'zod';
import { AppConfig } from './schema.ts';
import { interpolateStrict } from './secret-interpolate.ts';
import { EnvSecretSource } from './secret-source.ts';
import { formatZodError } from '../utils/zod-error.ts';

/**
 * Interpolate ${env:VAR_NAME} tokens inside an arbitrary JSON-like object.
 * Fails fast with a clear list of missing env vars.
 * Returns both the raw config (before interpolation) and the validated interpolated config.
 */

async function resolveAndValidate(
  raw: unknown,
): Promise<{ raw: unknown; interpolated: AppConfig }> {
  const interpolated = await interpolateStrict(raw, { env: new EnvSecretSource() });
  // Zod validation after secrets are in place
  try {
    const validated = AppConfig.parse(interpolated);
    return { raw, interpolated: validated };
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new Error(`Failed to validate config:\n${formatZodError(error)}`);
    }
    throw new Error(
      `Failed to validate config: ${error instanceof Error ? error.message : 'Unknown error'}`,
    );
  }
}

/**
 * Parses a JSON string or base64 encoded JSON string into an object
 */
function parseJsonOrBase64(input: string): unknown {
  // First try to parse as regular JSON
  try {
    return JSON.parse(input);
  } catch {
    // If that fails, try to decode as base64 and then parse as JSON
    try {
      const decoded = Buffer.from(input, 'base64').toString('utf-8');
      return JSON.parse(decoded);
    } catch {
      throw new Error('Input is neither valid JSON nor valid base64 encoded JSON');
    }
  }
}

// todo: change order so it pulls from env url first, then file
export async function loadConfig(
  filenameOrJson?: string,
): Promise<{ raw: unknown; interpolated: AppConfig }> {
  // Priority 1: Explicitly provided config as JSON/base64 string or filepath (from command line args)
  if (filenameOrJson) {
    // Check if input looks like JSON (starts with { or [) or contains base64-like characters
    if (
      filenameOrJson.trim().startsWith('{') ||
      filenameOrJson.trim().startsWith('[') ||
      /^[A-Za-z0-9+/=]+$/.test(filenameOrJson)
    ) {
      // Treat as JSON or base64 encoded JSON
      try {
        const configData = parseJsonOrBase64(filenameOrJson);
        return await resolveAndValidate(configData);
      } catch (error) {
        throw new Error(
          `Failed to parse provided config string: ${error instanceof Error ? error.message : 'Unknown error'}`,
        );
      }
    } else {
      // Treat as filepath
      const explicitConfigPath = isAbsolute(filenameOrJson)
        ? filenameOrJson
        : join(process.cwd(), filenameOrJson);
      if (existsSync(explicitConfigPath)) {
        const configContent = readFileSync(explicitConfigPath, 'utf-8');
        const configData = JSON.parse(configContent);
        return await resolveAndValidate(configData);
      }
      throw new Error(`Config file not found: ${filenameOrJson}`);
    }
  }

  // Priority 2: config.absinthe.json in current directory
  const defaultConfigPath = join(process.cwd(), 'config.absinthe.json');
  if (existsSync(defaultConfigPath)) {
    try {
      const configContent = readFileSync(defaultConfigPath, 'utf-8');
      const configData = JSON.parse(configContent);
      return await resolveAndValidate(configData);
    } catch (error) {
      throw new Error(
        `Failed to load config.absinthe.json: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  // Priority 3: process.env.INDEXER_CONFIG
  if (process.env.INDEXER_CONFIG) {
    try {
      const configData = JSON.parse(process.env.INDEXER_CONFIG);
      return await resolveAndValidate(configData);
    } catch (error) {
      throw new Error(
        `Failed to parse INDEXER_CONFIG: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  // No configuration found
  const errorMessage = filenameOrJson
    ? `No configuration found. Tried: ${filenameOrJson}, config.absinthe.json, and INDEXER_CONFIG environment variable.`
    : 'No configuration found. Please provide a config file path, JSON string, base64 encoded JSON string, ' +
      'config.absinthe.json file, or set the INDEXER_CONFIG environment variable.';

  throw new Error(errorMessage);
}
