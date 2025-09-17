// Univ3 Projector - handles custom events and emits generic engine events
import { Projector, ProjectorContext } from '../types/adapter.ts';
import { PositionStatusChange } from '../types/core.ts';
import Big from 'big.js';

export interface PositionIndexedPayload {
  tokenId: string;
  pool: string;
  tickLower: number;
  tickUpper: number;
}

export interface SwapObservedPayload {
  pool: string;
  fromTick: number;
  toTick: number;
  tickSpacing: number;
}

export class Univ3Projector implements Projector {
  namespace = 'univ3';

  async onCustom(type: string, payload: any, ctx: ProjectorContext): Promise<void> {
    switch (type) {
      case 'positionIndexed':
        await this.handlePositionIndexed(payload as PositionIndexedPayload, ctx);
        break;
      case 'swapObserved':
        await this.handleSwapObserved(payload as SwapObservedPayload, ctx);
        break;
      default:
        // Ignore unknown types
        break;
    }
  }

  private async handlePositionIndexed(
    payload: PositionIndexedPayload,
    ctx: ProjectorContext,
  ): Promise<void> {
    const { tokenId, pool, tickLower, tickUpper } = payload;

    // Store position boundaries in Redis sets for fast lookup during tick crossings
    const lowerKey = `univ3:pool:${pool}:lower:${tickLower}`;
    const upperKey = `univ3:pool:${pool}:upper:${tickUpper}`;

    await Promise.all([ctx.redis.sadd(lowerKey, tokenId), ctx.redis.sadd(upperKey, tokenId)]);

    // Also store position metadata for later reference
    const positionKey = `univ3:position:${tokenId}`;
    await ctx.redis.hset(positionKey, {
      pool,
      tickLower: tickLower.toString(),
      tickUpper: tickUpper.toString(),
    });
  }

  private async handleSwapObserved(
    payload: SwapObservedPayload,
    ctx: ProjectorContext,
  ): Promise<void> {
    const { pool, fromTick, toTick, tickSpacing } = payload;

    // Get all ticks that were crossed during this swap
    const crossedTicks = this.getCrossedTicks(fromTick, toTick, tickSpacing);

    for (const tick of crossedTicks) {
      await this.handleTickCrossing(pool, tick, ctx);
    }
  }

  private getCrossedTicks(fromTick: number, toTick: number, tickSpacing: number): number[] {
    const crossedTicks: number[] = [];
    const direction = fromTick < toTick ? 1 : -1;
    let currentTick = fromTick;

    while (currentTick !== toTick) {
      // Move to the next tick boundary
      let nextBoundary = Math.round(currentTick / tickSpacing) * tickSpacing;
      if (direction > 0) {
        nextBoundary += tickSpacing;
      } else {
        nextBoundary -= tickSpacing;
      }

      // Add the boundary tick if it's in the right direction
      if ((direction > 0 && nextBoundary <= toTick) || (direction < 0 && nextBoundary >= toTick)) {
        crossedTicks.push(nextBoundary);
        currentTick = nextBoundary;
      } else {
        break;
      }
    }

    return crossedTicks;
  }

  private async handleTickCrossing(
    pool: string,
    tick: number,
    ctx: ProjectorContext,
  ): Promise<void> {
    // Get positions that have this tick as a boundary
    const lowerKey = `univ3:pool:${pool}:lower:${tick}`;
    const upperKey = `univ3:pool:${pool}:upper:${tick}`;

    const [lowerPositions, upperPositions] = await Promise.all([
      ctx.redis.smembers(lowerKey),
      ctx.redis.smembers(upperKey),
    ]);

    // Positions that cross this tick as their lower boundary become active
    for (const tokenId of lowerPositions) {
      const assetKey = `erc721:0xe43ca1dee3f0fc1e2df73a0745674545f11a59f5:${tokenId}`.toLowerCase();
      const ownerKey = `asset:owner:${assetKey}`;
      const owner = await ctx.redis.get(ownerKey);

      if (owner) {
        await ctx.emit.positionStatusChange({
          user: owner,
          asset: assetKey,
          active: true, // tickLower crossed means position becomes active
        });
      }
    }

    // Positions that cross this tick as their upper boundary become inactive
    for (const tokenId of upperPositions) {
      const assetKey = `erc721:0xe43ca1dee3f0fc1e2df73a0745674545f11a59f5:${tokenId}`.toLowerCase();
      const ownerKey = `asset:owner:${assetKey}`;
      const owner = await ctx.redis.get(ownerKey);

      if (owner) {
        await ctx.emit.positionStatusChange({
          user: owner,
          asset: assetKey,
          active: false, // tickUpper crossed means position becomes inactive
        });
      }
    }
  }
}
