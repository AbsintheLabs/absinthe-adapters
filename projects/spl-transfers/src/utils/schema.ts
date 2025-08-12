import { ProtocolType } from '@absinthe/common';
import { z } from 'zod';

const splTransfersProtocolSchema = z.object({
  type: z.enum([ProtocolType.SPL_TRANSFERS]),
  name: z.string(),
  contractAddress: z.string(),
  chainId: z.number(),
  toBlock: z.number(),
  fromBlock: z.number(),
  balanceFlushIntervalHours: z.number(),
});

export { splTransfersProtocolSchema };
