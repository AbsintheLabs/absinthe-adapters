import crypto from 'crypto';

function stableSort(obj: any): any {
  if (Array.isArray(obj)) return obj.map(stableSort);
  if (obj && typeof obj === 'object') {
    return Object.fromEntries(
      Object.keys(obj)
        .sort()
        .map((k) => [k, stableSort(obj[k])]),
    );
  }
  return obj;
}

export function md5HashCanonical(value: unknown, len?: number): string {
  const canon = stableSort(value);
  const json = JSON.stringify(canon);
  const md5 = crypto.createHash('md5').update(json).digest('hex');
  return len ? md5.slice(0, len) : md5;
}
