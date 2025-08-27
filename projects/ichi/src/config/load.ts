// config/load.ts
import { config as dotenv } from 'dotenv';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { AppConfig } from './schema';

dotenv();

export function loadConfig(filename?: string) {
  const configFilename = filename || 'config.absinthe.json';
  const localConfigPath = join(process.cwd(), configFilename);
  const hasLocalConfig = existsSync(localConfigPath);
  const hasEnvConfig = !!process.env.INDEXER_CONFIG;

  // Error if both are defined (only when using default filename)
  if (!filename && hasLocalConfig && hasEnvConfig) {
    throw new Error(
      'Configuration conflict: Both config.absinthe.json file and INDEXER_CONFIG environment variable are defined. ' +
        'Please use only one configuration source.',
    );
  }

  // If a specific filename is provided, only try that file
  if (filename) {
    if (hasLocalConfig) {
      try {
        const configContent = readFileSync(localConfigPath, 'utf-8');
        const configData = JSON.parse(configContent);
        return AppConfig.parse(configData);
      } catch (error) {
        throw new Error(
          `Failed to load ${configFilename}: ${error instanceof Error ? error.message : 'Unknown error'}`,
        );
      }
    } else {
      throw new Error(`Configuration file not found: ${configFilename}`);
    }
  }

  // Try local config first (default behavior)
  if (hasLocalConfig) {
    try {
      const configContent = readFileSync(localConfigPath, 'utf-8');
      const configData = JSON.parse(configContent);
      return AppConfig.parse(configData);
    } catch (error) {
      throw new Error(
        `Failed to load ${configFilename}: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  // Fall back to environment variable
  if (hasEnvConfig) {
    try {
      const configData = JSON.parse(process.env.INDEXER_CONFIG as string);
      return AppConfig.parse(configData);
    } catch (error) {
      throw new Error(
        `Failed to parse INDEXER_CONFIG: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  // No configuration found
  throw new Error(
    `No configuration found. Please provide either a ${configFilename} file or set the INDEXER_CONFIG environment variable.`,
  );
}
