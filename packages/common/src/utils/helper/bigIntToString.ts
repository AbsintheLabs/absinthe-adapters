// Helper function to convert BigInt values to strings for JSON serialization
export const convertBigIntToString = (obj: any): any => {
    if (obj === null || obj === undefined) {
        return obj;
    }

    if (typeof obj === 'bigint') {
        return obj.toString();
    }

    if (Array.isArray(obj)) {
        return obj.map(convertBigIntToString);
    }

    if (typeof obj === 'object') {
        const result: any = {};
        for (const key in obj) {
            result[key] = convertBigIntToString(obj[key]);
        }
        return result;
    }

    return obj;
};