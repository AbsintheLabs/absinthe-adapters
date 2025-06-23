import { BlockHeader } from './interfaces/interfaces';
export class BlockMap<T> extends Map<BlockHeader, T[]> {
  push(
    block: {
      id: string;
      height: number;
      hash: string;
      parentHash: string;
      timestamp: number;
    },
    ...items: T[]
  ) {
    let blockItems = this.get(block);
    if (!blockItems) {
      this.set(block, items);
    } else {
      blockItems.push(...items);
    }
    return this;
  }

  some(
    block: {
      id: string;
      height: number;
      hash: string;
      parentHash: string;
      timestamp: number;
    },
    fn: (item: T) => boolean,
  ) {
    let blockItems = this.get(block);
    if (blockItems) {
      return blockItems.some(fn);
    }
    return false;
  }

  map<R>(
    fn: (
      block: {
        id: string;
        height: number;
        hash: string;
        parentHash: string;
        timestamp: number;
      },
      items: T[],
    ) => R[],
  ) {
    return new BlockMap(this.entriesArray().map(([block, items]) => [block, fn(block, items)]));
  }

  keysArray() {
    return [...this.keys()];
  }

  entriesArray() {
    return [...this.entries()];
  }

  valuesArray() {
    return [...this.values()];
  }
}
