export class PriceCache {
    private cache: Map<string, Map<Date, number>>;
    private windowDurationMs: number;

    constructor(windowDurationMs: number) {
        this.cache = new Map();
        this.windowDurationMs = windowDurationMs;
    }

}