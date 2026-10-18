export class DefineError extends Error {
    key?: string;

    constructor(message: string, key?: string) {
        super(message);
        this.name = 'DefineError';
        this.key = key;
    }
}

export interface DefineErrorInfo {
    message: string;
    key?: string;
}
