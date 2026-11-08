// SPDX-FileCopyrightText: 2026 Farhan Kurnia Pratama
//
// SPDX-License-Identifier: AGPL-3.0-only

import { expect, test } from 'bun:test';
import { createMdrsResolvers } from '../packages/lib/src/mdrsResolvers.ts';
import { hourSteps, localHourStart } from '../packages/data/src/d1/time.ts';
import { walkPath, type PathSegment } from '@mdrs/core';

const prop = (name: string): PathSegment => ({ kind: 'prop', name });
const index = (value: number | string): PathSegment => ({ kind: 'index', value });

test('loads author, analytics and single or listed posts once each through the registry', async () => {
    const calls: string[] = [];
    const registry = createMdrsResolvers({
        author: async () => {
            calls.push('author');
            return { name: 'Ada' };
        },
        blogList: async () => {
            calls.push('list');
            return [{ title: 'One' }];
        },
        blogPost: async slug => {
            calls.push(`post:${slug}`);
            return { title: slug };
        },
        analytics: async () => {
            calls.push('analytics');
            return { views: 3 };
        }
    });
    expect(walkPath(await registry.author!([prop('name')]), [])).toBeDefined();
    await registry.author!([prop('name')]);
    expect(calls.filter(call => call === 'author')).toHaveLength(1);
    await registry.analytics!([prop('views')]);
    await registry.blog!([index(0), prop('title')]);
    await registry.blog!([index('hello'), prop('title')]);
    await registry.blog!([index('hello'), prop('title')]);
    expect(calls).toEqual(['author', 'analytics', 'list', 'post:hello']);
});

test('steps through local hours in order and aligns to the hour', () => {
    const start = Date.UTC(2026, 0, 2, 10, 30, 15, 250);
    const aligned = localHourStart(start, 'UTC');
    expect(aligned).toBe(Date.UTC(2026, 0, 2, 10, 0, 0, 0));
    const steps = hourSteps(start, start + 3 * 3_600_000, 'UTC');
    expect(steps.length).toBe(4);
    expect(steps[1] - steps[0]).toBe(3_600_000);
});
