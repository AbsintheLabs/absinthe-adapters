import { ProtocolType } from '@absinthe/common';
import { z } from 'zod';

const hemiStakingProtocolSchema = z.object({
  type: z.enum([ProtocolType.HEMISTAKING]),
  name: z.string(),
  contractAddress: z.string(),
  chainId: z.number(),
  toBlock: z.number(),
  fromBlock: z.number(),
  balanceFlushIntervalHours: z.number(),
});

export { hemiStakingProtocolSchema };
