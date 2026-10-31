// SPDX-FileCopyrightText: 2026 Farhan Kurnia Pratama
//
// SPDX-License-Identifier: AGPL-3.0-only

export async function readJson<T = any>(response: Response): Promise<T> {
    const text = await response.text();
    try {
        return JSON.parse(text) as T;
    } catch {
        throw new Error(
            response.status >= 500 ?
                'The server could not finish this request. Try again in a moment.'
            :   'The server returned an unexpected response.'
        );
    }
}
