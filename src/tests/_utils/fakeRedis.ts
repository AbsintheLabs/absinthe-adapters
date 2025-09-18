export class FakeRedis {
  private kv = new Map<string, string>();
  private hm = new Map<string, Map<string, string>>();
  private sets = new Map<string, Set<string>>();
  private zsets = new Map<string, Map<string, number>>();

  async get(k: string) {
    return this.kv.get(k) ?? null;
  }
  async set(k: string, v: string) {
    this.kv.set(k, v);
  }

  async hgetall(k: string) {
    const m = this.hm.get(k);
    if (!m) return {};
    const out: Record<string, string> = {};
    for (const [kk, vv] of m.entries()) out[kk] = vv;
    return out;
  }
  async hsetnx(k: string, field: string, val: string) {
    let m = this.hm.get(k);
    if (!m) {
      m = new Map();
      this.hm.set(k, m);
    }
    if (!m.has(field)) m.set(field, val);
  }
  async hset(k: string, obj: Record<string, string>) {
    let m = this.hm.get(k);
    if (!m) {
      m = new Map();
      this.hm.set(k, m);
    }
    for (const [f, v] of Object.entries(obj)) m.set(f, v);
  }
  async hmget(k: string, ...fields: string[]) {
    const m = this.hm.get(k) ?? new Map<string, string>();
    return fields.map((f) => m.get(f) ?? null);
  }

  async sadd(k: string, v: string) {
    let s = this.sets.get(k);
    if (!s) {
      s = new Set();
      this.sets.set(k, s);
    }
    s.add(v);
  }
  async srem(k: string, v: string) {
    const s = this.sets.get(k);
    if (s) s.delete(v);
  }
  async sdiff(keys: string[]) {
    const [first, ...rest] = keys;
    const base = new Set(this.sets.get(first) ?? []);
    for (const rk of rest) {
      const rs = this.sets.get(rk) ?? new Set();
      for (const x of rs) base.delete(x);
    }
    return Array.from(base);
  }
  async sismember(k: string, v: string) {
    const s = this.sets.get(k);
    return s?.has(v) ? 1 : 0;
  }

  async zadd(k: string, score: number, member: string) {
    let z = this.zsets.get(k);
    if (!z) {
      z = new Map();
      this.zsets.set(k, z);
    }
    z.set(member, score);
  }

  clear() {
    this.kv.clear();
    this.hm.clear();
    this.sets.clear();
    this.zsets.clear();
  }
}
