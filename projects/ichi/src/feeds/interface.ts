// interface.ts
import { FeedSelector, ResolveContext } from "../eprice";

// The main resolver: It is the implementation detail of each price source
export type ExecutorFn = (selector: FeedSelector, ctx: ResolveContext) => Promise<number>;

// This is what each handler looks like after it's been created
// It allows for recursive calls of its subtypes
export type HandlerFn<T extends FeedSelector['kind'] = FeedSelector['kind']> =
    (args: {
        selector: Extract<FeedSelector, { kind: T }>;
        ctx: ResolveContext;
        recurse: ExecutorFn
    }) =>
        Promise<number>;

// This factory takes in the implementation detail of the price source and returns a handler function
export type HandlerFactory<T extends FeedSelector['kind']> =
    (recurse: ExecutorFn) => HandlerFn<T>;