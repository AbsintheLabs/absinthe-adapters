export type Runtime = {
  machineHostname: string;
  version: string;
  commitSha?: string | null;
  apiKeyHash?: string | null;
  configHash: string;

  adapterName: string;
  adapterVersion: string;
};

let RUNTIME: Runtime | undefined;

export function setRuntime(partial: Partial<Runtime>) {
  RUNTIME = { ...(RUNTIME ?? ({} as Runtime)), ...partial };
}

export function getRuntime(): Runtime {
  if (!RUNTIME) throw new Error('Runtime not initialized');
  return RUNTIME;
}
