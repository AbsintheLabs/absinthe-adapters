export type Tx = {
  hash: string;
  from?: string;
  to?: string;
  gasUsed?: bigint;
  gasPrice?: bigint;
  status?: number;
};
export type Log = {
  address: string;
  topics: string[];
  data?: string;
  transactionHash: string;
  logIndex: number;
  transaction?: Tx;
};
export type Block = {
  header: { height: number; timestamp: number; hash?: string };
  logs: Log[];
  transactions: Tx[];
};

export class FakeProcessor {
  public requests: Array<{ request: { logs?: any[] } }> = [{ request: { logs: [{}] } }];
  private _blocks: Block[];
  constructor(blocks: Block[]) {
    this._blocks = blocks;
  }
  private makeCtx() {
    return { blocks: this._blocks, _chain: {}, store: { setForceFlush: (_: boolean) => {} } };
  }
  run(_: any, handler: (ctx: any) => Promise<void>) {
    return handler(this.makeCtx());
  }
}
