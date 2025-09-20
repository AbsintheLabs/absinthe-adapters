import { ChainArch } from '../config/schema.ts';
import { getChainShortName, getChainInfo } from '../utils/chain-utils.ts';

export type Runtime = {
  // machine
  machineHostname: string;
  version: string;
  commitSha?: string | null;
  apiKeyHash?: string | null;
  configHash: string;

  // adapter
  adapterName: string;
  adapterVersion: string;

  // chain
  chainId: number;
  chainArch: ChainArch;
  chainShortName: string;
};

let RUNTIME: Runtime | undefined;

export function setRuntime(partial: Partial<Runtime>) {
  RUNTIME = { ...(RUNTIME ?? ({} as Runtime)), ...partial };
}

export function getRuntime(): Runtime {
  if (!RUNTIME) throw new Error('Runtime not initialized');
  return RUNTIME;
}
