// config/load.ts
import { config as dotenv } from 'dotenv';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { AppConfig } from './schema';

dotenv();

export function loadConfig(filename?: string) {
  // Priority 1: Explicitly provided file path (from command line args)
  if (filename) {
    const explicitConfigPath = join(process.cwd(), filename);
    if (existsSync(explicitConfigPath)) {
      try {
        const configContent = readFileSync(explicitConfigPath, 'utf-8');
        const configData = JSON.parse(configContent);
        return AppConfig.parse(configData);
      } catch (error) {
        throw new Error(
          `Failed to load ${filename}: ${error instanceof Error ? error.message : 'Unknown error'}`,
        );
      }
    }
    // If explicit filename provided but doesn't exist, continue to fallback options
  }

  // Priority 2: absinthe.config.json in current directory
  const defaultConfigPath = join(process.cwd(), 'absinthe.config.json');
  if (existsSync(defaultConfigPath)) {
    try {
      const configContent = readFileSync(defaultConfigPath, 'utf-8');
      const configData = JSON.parse(configContent);
      return AppConfig.parse(configData);
    } catch (error) {
      throw new Error(
        `Failed to load absinthe.config.json: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  // Priority 3: process.env.INDEXER_CONFIG
  if (process.env.INDEXER_CONFIG) {
    try {
      const configData = JSON.parse(process.env.INDEXER_CONFIG);
      return AppConfig.parse(configData);
    } catch (error) {
      throw new Error(
        `Failed to parse INDEXER_CONFIG: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  // No configuration found
  const errorMessage = filename
    ? `No configuration found. Tried: ${filename}, absinthe.config.json, and INDEXER_CONFIG environment variable.`
    : 'No configuration found. Please provide absinthe.config.json file, set the INDEXER_CONFIG environment variable, or specify a config file path.';

  throw new Error(errorMessage);
}
