// SPDX-FileCopyrightText: 2026 Farhan Kurnia Pratama
//
// SPDX-License-Identifier: MIT OR Apache-2.0

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
