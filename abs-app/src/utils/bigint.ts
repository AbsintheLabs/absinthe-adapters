/**
 * Helper function to handle BigInt serialization
 */
export const handleBigIntSerialization = (data: any): any => {
    if (data === null || data === undefined) return data;

    if (typeof data === 'bigint') {
        return data.toString();
    }

    if (Array.isArray(data)) {
        return data.map(handleBigIntSerialization);
    }

    if (typeof data === 'object') {
        const result: Record<string, any> = {};
        for (const key in data) {
            result[key] = handleBigIntSerialization(data[key]);
        }
        return result;
    }

    return data;
};

/**
 * JSON reviver function for parsing BigInt values
 */
export const bigIntReviver = (key: string, value: any): any => {
    // Convert string values that look like BigInt to regular numbers
    if (typeof value === 'string' && /^\d+n$/.test(value)) {
        return value.slice(0, -1); // Remove the 'n' suffix and return as string
    }
    return value;
}; 