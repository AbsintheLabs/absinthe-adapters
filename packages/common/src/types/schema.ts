import z from "zod";

// Protocol configuration schemas
const baseProtocolSchema = z.object({
    contractAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/, 'Contract address must be a valid Ethereum address'),
    fromBlock: z.number(),
    name: z.string().optional(),
});

const tokenSchema = z.object({
    coingeckoId: z.string(),
    decimals: z.number()
});

// Updated schema to support multiple protocol types
const protocolConfigSchema = z.discriminatedUnion('type', [
    // Uniswap V2
    z.object({
        type: z.literal('uniswap-v2'),
        ...baseProtocolSchema.shape,
        pricingStrategy: z.string(),
        token0: tokenSchema,
        token1: tokenSchema,
        preferredTokenCoingeckoId: z.enum(['token0', 'token1'])
    }),
    
    // Uniswap V3
    z.object({
        type: z.literal('uniswap-v3'),
        ...baseProtocolSchema.shape,
        fee: z.number(),
        token0: tokenSchema,
        token1: tokenSchema,
        preferredTokenCoingeckoId: z.enum(['token0', 'token1'])
    }),
    
    // Compound
    z.object({
        type: z.literal('compound'),
        ...baseProtocolSchema.shape,
        version: z.enum(['v2', 'v3']),
        underlyingToken: tokenSchema,
        cToken: tokenSchema
    }),
    
    // Aave
    z.object({
        type: z.literal('aave'),
        ...baseProtocolSchema.shape,
        version: z.enum(['v2', 'v3']),
        underlyingToken: tokenSchema,
        aToken: tokenSchema
    }),
    
    // Curve
    z.object({
        type: z.literal('curve'),
        ...baseProtocolSchema.shape,
        tokens: z.array(tokenSchema),
        poolType: z.enum(['stable', 'crypto'])
    }),
    
    // Balancer
    z.object({
        type: z.literal('balancer'),
        ...baseProtocolSchema.shape,
        tokens: z.array(tokenSchema),
        poolType: z.enum(['weighted', 'stable']),
        weights: z.array(z.number()).optional()
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