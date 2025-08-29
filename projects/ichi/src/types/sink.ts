export interface Sink {
  init?(): Promise<void>;
  write(batch: unknown[]): Promise<void>; // or writeOne(e: unknown)
  flush?(): Promise<void>;
  close?(): Promise<void>;
}

// Factory input selected at engine construction
export type SinkConfig =
  | { kind: 'csv'; path: string }
  | { kind: 'absinthe'; url: string; apiKey?: string; rateLimit?: number; batchSize?: number };
