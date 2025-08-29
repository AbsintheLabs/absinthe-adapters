// config/load.ts
import { config as dotenv } from 'dotenv';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { AppConfig } from './schema';

dotenv();

export function loadConfig(filename?: string) {
  let configData: any = {};
  // Debug: Log environment variables
  console.log('ABSINTHE_API_URL:', process.env.ABSINTHE_API_URL);
  console.log('ABSINTHE_API_KEY:', process.env.ABSINTHE_API_KEY);

  // Priority 1: Explicitly provided file path (from command line args)
  if (filename) {
    const explicitConfigPath = join(process.cwd(), filename);
    if (existsSync(explicitConfigPath)) {
      try {
        const configContent = readFileSync(explicitConfigPath, 'utf-8');
        configData = JSON.parse(configContent);
      } catch (error) {
        throw new Error(
          `Failed to load ${filename}: ${error instanceof Error ? error.message : 'Unknown error'}`,
        );
      }
    }
    // If explicit filename provided but doesn't exist, continue to fallback options
  }

  // Priority 2: absinthe.config.json in current directory (if no explicit file was loaded)
  if (!configData.indexerId) {
    const defaultConfigPath = join(process.cwd(), 'absinthe.config.json');
    if (existsSync(defaultConfigPath)) {
      try {
        const configContent = readFileSync(defaultConfigPath, 'utf-8');
        configData = JSON.parse(configContent);
      } catch (error) {
        throw new Error(
          `Failed to load absinthe.config.json: ${error instanceof Error ? error.message : 'Unknown error'}`,
        );
      }
    }
  }

  // Priority 3: process.env.INDEXER_CONFIG (if no file config was loaded)
  if (!configData.indexerId && process.env.INDEXER_CONFIG) {
    try {
      configData = JSON.parse(process.env.INDEXER_CONFIG);
    } catch (error) {
      throw new Error(
        `Failed to parse INDEXER_CONFIG: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  // Always merge in Absinthe API configuration from environment variables
  // These should always be available regardless of config source
  if (process.env.ABSINTHE_API_URL) {
    configData.absintheApiUrl = process.env.ABSINTHE_API_URL;
  }
  if (process.env.ABSINTHE_API_KEY) {
    configData.absintheApiKey = process.env.ABSINTHE_API_KEY;
  }

  // Validate we have some configuration
  if (!configData.indexerId) {
    const errorMessage = filename
      ? `No configuration found. Tried: ${filename}, absinthe.config.json, and INDEXER_CONFIG environment variable.`
      : 'No configuration found. Please provide absinthe.config.json file, set the INDEXER_CONFIG environment variable, or specify a config file path.';

    throw new Error(errorMessage);
  }

  // Parse and validate the final configuration
  try {
    return AppConfig.parse(configData);
  } catch (error) {
    throw new Error(
      `Configuration validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
    );
  }
}
