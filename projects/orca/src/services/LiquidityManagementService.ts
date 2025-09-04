// import { PositionStorageService } from './PositionStorageService';

// export class LiquidityManagementService {
//   private positionStorageService: PositionStorageService;

//   constructor(positionStorageService: PositionStorageService) {
//     this.positionStorageService = positionStorageService;
//   }

//   private async activatePosition(
//     block: BlockHeader,
//     currentTick: number,
//     positions: PositionData[],
//   ) {
//     for (const position of positions) {
//       position.isActive = 'true';
//       position.currentTick = currentTick;
//       position.lastUpdatedBlockTs = block.timestamp;
//       position.lastUpdatedBlockHeight = block.height;
//       await this.positionStorageService.updatePosition(position);

//       console.log(`Started tracking position ${position.positionId}`);
//     }
//   }

//   private async deactivatePosition(
//     block: BlockHeader,
//     currentTick: number,
//     positions: PositionData[],
//     protocolStates: Map<string, ProtocolStateUniswapV3>,
//     coingeckoApiKey: string,
//     chainPlatform: string,
//   ) {
//     for (const position of positions) {
//       position.isActive = 'false';
//       position.currentTick = currentTick;
//       let balanceWindow: HistoryWindow | null = null;
//       await this.positionStorageService.updatePosition(position); //todo: efficiency - double call

//       const token0 = await this.positionStorageService.getToken(position.token0Id);
//       const token1 = await this.positionStorageService.getToken(position.token1Id);
//       if (!token0 || !token1) {
//         logger.warn(`❌ Skipping position ${position.positionId} - missing token data:`, {
//           token0Exists: !!token0,
//           token0Id: position.token0Id,
//         });
//         return;
//       }

//       const oldLiquidity = BigInt(position.liquidity);

//       const { humanAmount0: oldHumanAmount0, humanAmount1: oldHumanAmount1 } =
//         getAmountsForLiquidityRaw(
//           oldLiquidity,
//           position.tickLower,
//           position.tickUpper,
//           position.currentTick,
//           token0.decimals,
//           token1.decimals,
//         );
//       const [token0inUSD, token1inUSD] = await getOptimizedTokenPrices(
//         position.poolId,
//         token0,
//         token1,
//         block,
//         coingeckoApiKey,
//         chainPlatform,
//       );

//       const oldLiquidityUSD =
//         Number(oldHumanAmount0) * token0inUSD + Number(oldHumanAmount1) * token1inUSD;

//       if (oldLiquidityUSD !== 0 && position.lastUpdatedBlockTs) {
//         balanceWindow = {
//           userAddress: position.owner,
//           deltaAmount: 0,
//           trigger: TimeWindowTrigger.EXHAUSTED,
//           startTs: position.lastUpdatedBlockTs,
//           endTs: block.timestamp,
//           windowDurationMs: this.windowDurationMs,
//           startBlockNumber: position.lastUpdatedBlockHeight,
//           endBlockNumber: block.height,
//           txHash: null,
//           currency: Currency.USD,
//           valueUsd: Number(oldLiquidityUSD),
//           balanceBefore: oldLiquidityUSD.toString(),
//           balanceAfter: oldLiquidityUSD.toString(),
//           tokenPrice: 0,
//           tokenDecimals: 0,
//           tokens: {
//             isActive: {
//               value: 'false',
//               type: 'boolean',
//             },
//             currentTick: {
//               value: currentTick.toString(),
//               type: 'number',
//             },
//             tickLower: {
//               value: position.tickLower.toString(),
//               type: 'number',
//             },
//             tickUpper: {
//               value: position.tickUpper.toString(),
//               type: 'number',
//             },
//             liquidity: {
//               value: position.liquidity.toString(),
//               type: 'number',
//             },
//             token0Id: {
//               value: position.token0Id,
//               type: 'string',
//             },
//             token1Id: {
//               value: position.token1Id,
//               type: 'string',
//             },
//           },
//         };
//       }
//       position.lastUpdatedBlockTs = block.timestamp;
//       position.lastUpdatedBlockHeight = block.height;
//       const poolState = protocolStates.get(position.poolId);
//       await this.positionStorageService.updatePosition(position);

//       if (poolState) {
//         if (balanceWindow) {
//           poolState.balanceWindows.push(balanceWindow);
//         }
//       } else {
//         protocolStates.set(position.poolId, {
//           balanceWindows: balanceWindow ? [balanceWindow] : [],
//           transactions: [],
//         });
//       }

//       console.log(`Stopped tracking position ${position.positionId}`);
//     }
//   }
// }
