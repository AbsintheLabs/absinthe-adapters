export class FakeSink {
  public writes: any[] = [];
  async write(batch: any[]) {
    this.writes.push(...batch);
  }
  async flush() {}
  async close() {}
}
