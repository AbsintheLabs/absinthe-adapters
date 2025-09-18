// config/secret-source.ts
export interface SecretSource {
  name: string;
  get(key: string): Promise<string | undefined>;
}

export class EnvSecretSource implements SecretSource {
  name = 'env';
  async get(key: string) {
    return process.env[key];
  }
}
