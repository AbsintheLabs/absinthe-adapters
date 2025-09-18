export type RunMeta = {
  machineHostname: string;
  version: string;
  commitSha?: string | null;
  apiKeyHash?: string | null;
  configHash: string;
};

let current: RunMeta | null = null;

export function setRuntime(meta: RunMeta) {
  current = Object.freeze({ ...meta });
}

export function getRuntime(): RunMeta {
  if (!current) throw new Error('Runtime context not initialized');
  return current;
}
