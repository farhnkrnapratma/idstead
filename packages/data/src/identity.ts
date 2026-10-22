export interface IdentityVersions {
    avatar: string | null;
    banner: string | null;
}

export interface IdentityVersionReader {
    current(): Promise<IdentityVersions>;
}
