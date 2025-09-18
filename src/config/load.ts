// config/load.ts
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { AppConfig } from './schema.ts';
import { interpolateStrict } from './secret-interpolate.ts';
import { EnvSecretSource } from './secret-source.ts';

/**
 * Interpolate ${env:VAR_NAME} tokens inside an arbitrary JSON-like object.
 * Fails fast with a clear list of missing env vars.
 */

async function resolveAndValidate(raw: unknown) {
  const interpolated = await interpolateStrict(raw, { env: new EnvSecretSource() });
  // Zod validation after secrets are in place
  return AppConfig.parse(interpolated);
}

export async function loadConfig(filename?: string) {
  // Priority 1: Explicitly provided file path (from command line args)
  if (filename) {
    const explicitConfigPath = join(process.cwd(), filename);
    if (existsSync(explicitConfigPath)) {
      try {
        const configContent = readFileSync(explicitConfigPath, 'utf-8');
        const configData = JSON.parse(configContent);
        return await resolveAndValidate(configData);
      } catch (error) {
        throw new Error(
          `Failed to load ${filename}: ${error instanceof Error ? error.message : 'Unknown error'}`,
        );
      }
    }
    // If explicit filename provided but doesn't exist, continue to fallback options
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
  const errorMessage = filename
    ? `No configuration found. Tried: ${filename}, config.absinthe.json, and INDEXER_CONFIG environment variable.`
    : 'No configuration found. Please provide config.absinthe.json file, set the INDEXER_CONFIG environment variable, or specify a config file path.';

  throw new Error(errorMessage);
}
