export class DataError extends Error {
    readonly operation: string;

    constructor(operation: string, cause?: unknown) {
        super(`Data operation failed: ${operation}`, { cause });
        this.name = 'DataError';
        this.operation = operation;
    }
}
