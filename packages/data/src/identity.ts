// SPDX-FileCopyrightText: 2026 Farhan Kurnia Pratama
//
// SPDX-License-Identifier: AGPL-3.0-only

export interface IdentityVersions {
    avatar: string | null;
    banner: string | null;
}

export interface IdentityVersionReader {
    current(): Promise<IdentityVersions>;
}
