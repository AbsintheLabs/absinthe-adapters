export const createBoundFunction = <T>(context: T) => {
    return function (this: T, ...args: any[]) {
        // This function will have access to the passed context as 'this'
        // and can access variables from the surrounding scope when called
        return this; // 'this' will be the provided context
    };
};