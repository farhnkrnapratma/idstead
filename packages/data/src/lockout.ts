export interface LoginLockoutStore {
    retryAfter(keys: string[]): Promise<number>;
    recordFailure(keys: string[]): Promise<void>;
    clear(keys: string[]): Promise<void>;
}
