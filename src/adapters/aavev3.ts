// common imports
import z from 'zod';
import Big from 'big.js';

// AaveV3 ABI imports (these need to be added to the abi directory)
// aToken can use regular erc20 abi
import * as erc20Abi from '../abi/erc20.ts';
// variable debt token needs to use aavev3variabledebttoken abi
import * as aaveV3VarDebtAbi from '../abi/aavev3variabledebttoken.ts';

// New registry imports
import { defineAdapter, ZodEvmAddress } from '../adapter-core.ts';
import { registerAdapter } from '../adapter-registry.ts';

export const aavev3 = registerAdapter(
  defineAdapter({
    name: 'aave-v3',
    semver: '0.0.1',
    schema: z
      .object({
        // poolDataProviderAddress: Address,
        aTokenAddress: ZodEvmAddress.optional(),
        variableDebtTokenAddress: ZodEvmAddress.optional(),
      })
      .refine((params) => !!params.aTokenAddress || !!params.variableDebtTokenAddress, {
        message: 'At least one of aTokenAddress or variableDebtTokenAddress must be provided',
        path: ['aTokenAddress', 'variableDebtTokenAddress'],
      }),
    build: ({ params, io }) => {
      // Event topics would be defined here based on actual ABI
      const transferTopic = erc20Abi.events.Transfer.topic;
      const varMintTopic = aaveV3VarDebtAbi.events.Mint.topic;
      const varBurnTopic = aaveV3VarDebtAbi.events.Burn.topic;
      const RAY = Big(10).pow(27);

      return {
        buildProcessor: (base) => {
          if (params.variableDebtTokenAddress) {
            base.addLog({
              address: [params.variableDebtTokenAddress],
              topic0: [varMintTopic, varBurnTopic],
            });
          }
          if (params.aTokenAddress) {
            base.addLog({
              address: [params.aTokenAddress],
              topic0: [transferTopic],
            });
          }
          return base;
        },
        onInit: async ({ rpcCtx: rpc, redis }) => {
          // Initialize any required state
        },
        onLog: async ({ block, log, emit, rpcCtx: rpc, redis }) => {
          // Lending
          if (params.aTokenAddress) {
            if (log.topics[0] === transferTopic) {
              const { from, to, value } = erc20Abi.events.Transfer.decode(log);
              await emit.balanceDelta({
                user: from,
                asset: params.aTokenAddress,
                amount: Big(value.toString()),
                activity: 'lend',
              });
            }
          }

          // Borrowing
          // mint
          if (params.variableDebtTokenAddress) {
            if (log.topics[0] === varMintTopic) {
              const { value, index, onBehalfOf } = aaveV3VarDebtAbi.events.Mint.decode(log);
              const scaledAmt = Big(value.toString())
                .mul(RAY)
                .div(Big(index.toString()))
                .round(0, Big.roundUp);
              await emit.balanceDelta({
                user: onBehalfOf,
                // asset: createVarDebtTokenKey(params.variableDebtTokenAddress, onBehalfOf),
                asset: params.variableDebtTokenAddress,
                // amount: scaledAmt,
                amount: Big(value.toString()),
                activity: 'borrow',
              });
            }
            // burn
            if (log.topics[0] === varBurnTopic) {
              const { value, index, from } = aaveV3VarDebtAbi.events.Burn.decode(log);
              const scaledAmt = Big(value.toString())
                .mul(RAY)
                .div(Big(index.toString()))
                .round(0, Big.roundDown);
              await emit.balanceDelta({
                user: from,
                // asset: createVarDebtTokenKey(params.variableDebtTokenAddress, from),
                asset: params.variableDebtTokenAddress,
                // amount: scaledAmt.neg(),
                amount: Big(value.toString()).neg(),
                activity: 'borrow',
              });
            }
            // no transfer since variable debt token is not transferable
          }
        },
        onBatchEnd: async ({ io }) => {
          // Any cleanup operations
        },
        projectors: [], // Add projectors if needed
      };
    },
  }),
);
