import z from "zod";

// Protocol configuration schemas
const baseProtocolSchema = z.object({
    contractAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/, 'Contract address must be a valid address'),
    fromBlock: z.number(),
    name: z.string().optional(),
});

const tokenSchema = z.object({
    coingeckoId: z.string(),
    decimals: z.number()
});

// Updated schema to support multiple protocol types
const protocolConfigSchema = z.discriminatedUnion('type', [
    // Hemi Staking
    z.object({
        type: z.literal('hemi'),
        ...baseProtocolSchema.shape,
        pricingStrategy: z.string(),
        token: tokenSchema,
    })
]);

const configSchema = z.object({
    chainId: z.number(),
    gatewayUrl: z.string().url('Gateway URL must be a valid URL'),
    toBlock: z.number().optional(),
    balanceFlushIntervalHours: z.number(),
    protocols: z.array(protocolConfigSchema)
});


export { configSchema };