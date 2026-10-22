export interface StoredArdIndex {
    entries: unknown;
    indexedAt: string;
}

export interface ArdIndexStore {
    read(siteUrl: string): Promise<StoredArdIndex | null>;
    write(
        siteUrl: string,
        entries: readonly unknown[],
        sources: string[],
        indexedAt: string
    ): Promise<void>;
}
