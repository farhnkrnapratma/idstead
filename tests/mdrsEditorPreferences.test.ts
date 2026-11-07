// SPDX-FileCopyrightText: 2026 Farhan Kurnia Pratama
//
// SPDX-License-Identifier: AGPL-3.0-only

import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { EditorPreferences } from '../packages/mdrs/editor/src/preferences.svelte.ts';

const STORAGE_KEY = 'markdown_editor_preferences';
const realLocalStorage = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');

let memory: Map<string, string>;

function installStorage(overrides: Partial<Storage> = {}) {
    Object.defineProperty(globalThis, 'localStorage', {
        configurable: true,
        value: {
            getItem: (key: string) => memory.get(key) ?? null,
            setItem: (key: string, value: string) => void memory.set(key, value),
            ...overrides
        }
    });
}

beforeEach(() => {
    memory = new Map();
    installStorage();
});

afterEach(() => {
    if (realLocalStorage) Object.defineProperty(globalThis, 'localStorage', realLocalStorage);
    else delete (globalThis as { localStorage?: unknown }).localStorage;
});

const saved = () => JSON.parse(memory.get(STORAGE_KEY) ?? 'null');

describe('EditorPreferences', () => {
    test('starts with the documented defaults and derives the indent string', () => {
        const preferences = new EditorPreferences();
        expect(preferences.ready).toBe(false);
        expect(preferences.indent).toBe('    ');
        preferences.indentSize = 2;
        expect(preferences.indent).toBe('  ');
        preferences.indentMode = 'tabs';
        expect(preferences.indent).toBe('\t');
    });

    test('loads saved values and ignores invalid ones', () => {
        memory.set(
            STORAGE_KEY,
            JSON.stringify({
                indentMode: 'tabs',
                indentSize: 8,
                lineWrapMode: 'none',
                showLineNumbers: false,
                autosaveEnabled: false
            })
        );
        const preferences = new EditorPreferences();
        preferences.load();
        expect(preferences).toMatchObject({
            indentMode: 'tabs',
            indentSize: 8,
            lineWrapMode: 'none',
            showLineNumbers: false,
            autosaveEnabled: false,
            ready: true
        });

        memory.set(
            STORAGE_KEY,
            JSON.stringify({
                indentMode: 'mixed',
                indentSize: 3,
                lineWrapMode: 'wrap',
                showLineNumbers: 'yes',
                autosaveEnabled: 0
            })
        );
        const fallback = new EditorPreferences();
        fallback.load();
        expect(fallback).toMatchObject({
            indentMode: 'spaces',
            indentSize: 4,
            lineWrapMode: 'soft',
            showLineNumbers: true,
            autosaveEnabled: true,
            ready: true
        });
    });

    test('keeps defaults for empty, non-object and unreadable storage', () => {
        for (const stored of [null, '"text"', '42', '{not json']) {
            if (stored === null) memory.clear();
            else memory.set(STORAGE_KEY, stored);
            const preferences = new EditorPreferences();
            preferences.load();
            expect(preferences.indentMode).toBe('spaces');
            expect(preferences.ready).toBe(true);
        }
        installStorage({
            getItem: () => {
                throw new Error('blocked');
            }
        });
        const blocked = new EditorPreferences();
        blocked.load();
        expect(blocked.ready).toBe(true);
    });

    test('persists every change', () => {
        const preferences = new EditorPreferences();
        preferences.toggleIndentMode();
        expect(saved()).toMatchObject({ indentMode: 'tabs' });
        preferences.setIndentSize(2);
        expect(saved()).toMatchObject({ indentSize: 2 });
        preferences.toggleLineWrap();
        expect(saved()).toMatchObject({ lineWrapMode: 'none' });
        preferences.toggleLineNumbers();
        expect(saved()).toMatchObject({ showLineNumbers: false });
        preferences.toggleAutosave();
        expect(saved()).toMatchObject({ autosaveEnabled: false });
        preferences.toggleIndentMode();
        preferences.toggleLineWrap();
        expect(preferences.indentMode).toBe('spaces');
        expect(preferences.lineWrapMode).toBe('soft');
    });

    test('keeps working when storage refuses writes', () => {
        installStorage({
            setItem: () => {
                throw new Error('full');
            }
        });
        const preferences = new EditorPreferences();
        preferences.toggleIndentMode();
        preferences.setIndentSize(8);
        expect(preferences.indentMode).toBe('tabs');
        expect(preferences.indentSize).toBe(8);
    });
});
