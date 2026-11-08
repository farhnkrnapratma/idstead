// SPDX-FileCopyrightText: 2026 Farhan Kurnia Pratama
//
// SPDX-License-Identifier: AGPL-3.0-only

import { afterEach, beforeEach, expect, test } from 'bun:test';
import { main } from '../tooling/configure.ts';

const realArgv = process.argv;
const realExit = process.exit;
const realError = console.error;
const realLog = console.log;
let exits: number[] = [];
let logged: unknown[][] = [];

beforeEach(() => {
    exits = [];
    logged = [];
    process.argv = [...realArgv, '--check'];
    process.exit = ((code?: number) => {
        exits.push(code ?? 0);
        throw new Error('exit');
    }) as never;
    console.error = (...args: unknown[]) => void logged.push(args);
    console.log = (...args: unknown[]) => void logged.push(args);
});

afterEach(() => {
    process.argv = realArgv;
    process.exit = realExit;
    console.error = realError;
    console.log = realLog;
});

test('checks the rendered Wrangler configs against idstead.jsonc', async () => {
    try {
        await main();
    } catch (error) {
        expect((error as Error).message).toBe('exit');
    }
    expect(exits.every(code => code === 1)).toBe(true);
});
