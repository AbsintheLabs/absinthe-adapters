import { redisService } from './redis';
import { logToFile } from '../utils/logger';

interface ApiKeyValidationResult {
  isValid: boolean;
}

interface ValidationConfig {
  baseUrl: string;
  adminSecret: string;
  environment: 'dev' | 'staging' | 'prod';
}

export class ApiKeyValidationService {
  private config: ValidationConfig;

  constructor(config: ValidationConfig) {
    this.config = config;
  }

  private getValidationUrl(apiKey: string): string {
    const baseUrl = this.config.baseUrl;
    return `${baseUrl}/api/rest/absinthe-indexer/api-keys/validate/${apiKey}`;
  }

  async validateApiKey(apiKey: string): Promise<ApiKeyValidationResult> {
    const cached = await redisService.getApiKeyValidation(apiKey);
    logToFile(`API key validation found in cache for ${apiKey}`);
    if (cached) {
      logToFile(`API key validation found in cache for ${apiKey}`);
      return cached;
    }

    try {
      const validationUrl = this.getValidationUrl(apiKey);
      logToFile(`Validating API key ${apiKey} at ${validationUrl}`);
      const response = await fetch(validationUrl, {
        method: 'GET',
        headers: {
          'x-hasura-admin-secret': this.config.adminSecret,
          'Content-Type': 'application/json',
        },
      });
      logToFile(`Response from ${validationUrl}: ${response.status}`);
      const data = await response.json();
      logToFile(`Data from ${validationUrl}: ${JSON.stringify(data)}`);
      const keys = data.points_config_indexer_absinthe_api_keys;
      logToFile(`Keys from ${validationUrl}: ${JSON.stringify(keys)}`);
      const isValid = Array.isArray(keys) && keys.length > 0 && keys[0].active === true;
      logToFile(`Is valid: ${isValid}`);
      if (!isValid) {
        console.warn(`API key validation failed for ${apiKey}: ${response.status}`);
        const result: ApiKeyValidationResult = { isValid: false };
        return result;
      }
      const result: ApiKeyValidationResult = {
        isValid: true,
      };
      logToFile(`Setting API key validation in cache for ${apiKey}`);
      await redisService.setApiKeyValidation(apiKey, result);

      logToFile(`API key validation successful for ${apiKey}, client: ${data.client_id}`);
      return result;
    } catch (error) {
      logToFile(`Error validating API key ${apiKey}: ${JSON.stringify(error)}`);
      const result: ApiKeyValidationResult = { isValid: false };
      return result;
    }
  }
}
