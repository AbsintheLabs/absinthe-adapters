import {
  ChainId,
  ChainShortName,
  ChainType,
  ProtocolType,
  ChainName,
  GatewayUrl,
  ValidatedEnvBase,
} from '@absinthe/common';

interface TokenBalance {
  id: string;
  transactionIndex: number;
  account: string;
  preMint: string;
  postMint: string;
  preDecimals: number;
  postDecimals: number;
  preOwner: string;
  postOwner: string;
  preAmount: bigint;
  postAmount: bigint;
}

interface SplTransfersProtocol {
  type: ProtocolType.SPL_TRANSFERS;
  chainId: ChainId;
  chainShortName: ChainShortName;
  chainName: ChainName;
  chainArch: ChainType;
  gatewayUrl: GatewayUrl;
  rpcUrl: string;
  toBlock: number;
  fromBlock: number;
  name: string;
  contractAddress: string;
}

interface ValidatedEnv {
  baseConfig: ValidatedEnvBase;
  splTransfersProtocol: SplTransfersProtocol;
}
export type { TokenBalance, SplTransfersProtocol, ValidatedEnv };
