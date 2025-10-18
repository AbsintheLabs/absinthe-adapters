import { describe, it, expect } from 'vitest';
import {
  CsvSinkSchema,
  StdoutSinkSchema,
  AbsintheSinkSchema,
  SingleSinkSchema,
  MultipleSinksSchema,
} from '../config/schema.ts';

describe('Sink Config Validation', () => {
  describe('CsvSinkSchema', () => {
    it('should validate valid CSV sink config', () => {
      const config = {
        sinkType: 'csv',
        path: 'output.csv',
      };

      const result = CsvSinkSchema.safeParse(config);
      expect(result.success).toBe(true);
    });

    it('should reject CSV sink config with empty path', () => {
      const config = {
        sinkType: 'csv',
        path: '',
      };

      const result = CsvSinkSchema.safeParse(config);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toContain('CSV path cannot be empty');
      }
    });

    it('should reject CSV sink config without path', () => {
      const config = {
        sinkType: 'csv',
      };

      const result = CsvSinkSchema.safeParse(config);
      expect(result.success).toBe(false);
    });
  });

  describe('StdoutSinkSchema', () => {
    it('should validate valid stdout sink config', () => {
      const config = {
        sinkType: 'stdout',
      };

      const result = StdoutSinkSchema.safeParse(config);
      expect(result.success).toBe(true);
    });

    it('should validate stdout sink config with json option', () => {
      const config = {
        sinkType: 'stdout',
        json: true,
      };

      const result = StdoutSinkSchema.safeParse(config);
      expect(result.success).toBe(true);
    });
  });

  describe('AbsintheSinkSchema', () => {
    it('should validate valid absinthe sink config with all options', () => {
      const config = {
        sinkType: 'absinthe',
        url: 'https://api.example.com',
        apiKey: 'test-key',
        rateLimit: 20,
        batchSize: 500,
      };

      const result = AbsintheSinkSchema.safeParse(config);
      expect(result.success).toBe(true);
    });

    it('should apply defaults for missing optional fields', () => {
      const config = {
        sinkType: 'absinthe',
      };

      const result = AbsintheSinkSchema.safeParse(config);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.url).toBe('https://adapters.absinthe.network');
        expect(result.data.rateLimit).toBe(10);
        expect(result.data.batchSize).toBe(1000);
      }
    });

    it('should reject invalid URL', () => {
      const config = {
        sinkType: 'absinthe',
        url: 'not-a-valid-url',
      };

      const result = AbsintheSinkSchema.safeParse(config);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toContain('Invalid URL');
      }
    });

    it('should reject negative rateLimit', () => {
      const config = {
        sinkType: 'absinthe',
        rateLimit: -1,
      };

      const result = AbsintheSinkSchema.safeParse(config);
      expect(result.success).toBe(false);
    });

    it('should reject non-integer batchSize', () => {
      const config = {
        sinkType: 'absinthe',
        batchSize: 100.5,
      };

      const result = AbsintheSinkSchema.safeParse(config);
      expect(result.success).toBe(false);
    });
  });

  describe('SingleSinkSchema (discriminated union)', () => {
    it('should correctly discriminate between sink types', () => {
      const csvConfig = { sinkType: 'csv', path: 'test.csv' };
      const stdoutConfig = { sinkType: 'stdout' };
      const absintheConfig = { sinkType: 'absinthe' };

      expect(SingleSinkSchema.safeParse(csvConfig).success).toBe(true);
      expect(SingleSinkSchema.safeParse(stdoutConfig).success).toBe(true);
      expect(SingleSinkSchema.safeParse(absintheConfig).success).toBe(true);
    });

    it('should reject unknown sink type', () => {
      const config = {
        sinkType: 'unknown',
      };

      const result = SingleSinkSchema.safeParse(config);
      expect(result.success).toBe(false);
    });
  });

  describe('MultipleSinksSchema', () => {
    it('should validate config with multiple sinks', () => {
      const config = {
        sinks: [
          { sinkType: 'csv', path: 'output.csv' },
          { sinkType: 'stdout' },
          { sinkType: 'absinthe', apiKey: 'test-key' },
        ],
      };

      const result = MultipleSinksSchema.safeParse(config);
      expect(result.success).toBe(true);
    });

    it('should reject empty sinks array', () => {
      const config = {
        sinks: [],
      };

      const result = MultipleSinksSchema.safeParse(config);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toContain('At least one sink must be configured');
      }
    });

    it('should reject if any sink in array is invalid', () => {
      const config = {
        sinks: [
          { sinkType: 'csv', path: 'output.csv' },
          { sinkType: 'csv', path: '' }, // Invalid: empty path
        ],
      };

      const result = MultipleSinksSchema.safeParse(config);
      expect(result.success).toBe(false);
    });
  });
});
