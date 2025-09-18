import { z } from 'zod';

const printrMeteoraProtocolSchema = z.object({
  type: z.string(),
  name: z.string(),
  contractAddress: z.string(),
  chainId: z.number(),
  toBlock: z.number(),
  fromBlock: z.number(),
  balanceFlushIntervalHours: z.number(),
});

export { printrMeteoraProtocolSchema };
