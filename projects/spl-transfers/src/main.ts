import {
  AbsintheApiClient,
  validateEnv,
  HOURS_TO_MS,
  StakingProtocol,
  ProtocolType,
  getChainEnumKey,
  ChainId,
  ChainName,
  ChainShortName,
  ChainType,
  GatewayUrl,
  getRpcUrlForChain,
} from '@absinthe/common';
import { SplTransfersProcessor } from './BatchProcessor';
import { startBlock } from './utils/conts';
import * as tokenProgram from './abi/TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA';
import { SplTransfersProtocol } from './utils/types';
const env = validateEnv();

const apiClient = new AbsintheApiClient({
  baseUrl: env.baseConfig.absintheApiUrl,
  apiKey: env.baseConfig.absintheApiKey,
});

const chainKey = getChainEnumKey(ChainId.SOLANA);
if (!chainKey) {
  throw new Error('Chain key not found');
}
const chainName = ChainName[chainKey];
const chainShortName = ChainShortName[chainKey];
const chainArch = ChainType.SOLANA;
const gatewayUrl = GatewayUrl[chainKey];
const rpcUrl = getRpcUrlForChain(ChainId.SOLANA, env);

const splTransfersProtocol: SplTransfersProtocol = {
  type: ProtocolType.SPL_TRANSFERS,
  toBlock: 0,
  fromBlock: startBlock,
  name: 'SPL-Transfers',
  contractAddress: tokenProgram.programId,
  chainShortName: chainShortName,
  chainName: chainName,
  chainArch: chainArch,
  gatewayUrl: gatewayUrl,
  rpcUrl: rpcUrl,
  chainId: ChainId.SOLANA,
};

const chainConfig = {
  chainArch: splTransfersProtocol.chainArch,
  networkId: splTransfersProtocol.chainId,
  chainShortName: splTransfersProtocol.chainShortName,
  chainName: splTransfersProtocol.chainName,
};

const WINDOW_DURATION_MS = env.baseConfig.balanceFlushIntervalHours * HOURS_TO_MS;
const splTransfersProcessor = new SplTransfersProcessor(
  splTransfersProtocol,
  WINDOW_DURATION_MS,
  apiClient,
  env.baseConfig,
  chainConfig,
);
splTransfersProcessor.run();
