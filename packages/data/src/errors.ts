// SPDX-FileCopyrightText: 2026 Farhan Kurnia Pratama
//
// SPDX-License-Identifier: AGPL-3.0-only

export class DataError extends Error {
    readonly operation: string;

    constructor(operation: string, cause?: unknown) {
        super(`Data operation failed: ${operation}`, { cause });
        this.name = 'DataError';
        this.operation = operation;
    }
}
