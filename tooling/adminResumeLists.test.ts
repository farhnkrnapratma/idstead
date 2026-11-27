// SPDX-FileCopyrightText: 2026 Farhan Kurnia Pratama
//
// SPDX-License-Identifier: AGPL-3.0-only

import { expect, test } from 'bun:test';
import { flushSync } from 'svelte';
import {
    buttons,
    click,
    confirmDialog,
    failure,
    openAdmin,
    route,
    sent,
    settle,
    text,
    toast
} from './support/adminHarness.ts';

async function pick(field: string, label: string) {
    const trigger = buttons(new RegExp(`^${field}:`))[0];
    if (!trigger) throw new Error(`No dropdown ${field}`);
    trigger.click();
    flushSync();
    const option = [...document.querySelectorAll<HTMLElement>('[role="option"]')].find(
        element => element.textContent?.trim() === label
    );
    if (!option) throw new Error(`No option ${label} in ${field}`);
    option.click();
    await settle(4);
}

function submitButton(name: string) {
    const form = buttons(name)[0]?.closest('form');
    if (!form) throw new Error(`No form for ${name}`);
    return form;
}

function paste(target: Element, value: string) {
    const event = new Event('paste', { bubbles: true, cancelable: true });
    Object.defineProperty(event, 'clipboardData', { value: { getData: () => value } });
    target.dispatchEvent(event);
    flushSync();
    return event;
}

test('experience dates are validated before the resume is saved', async () => {
    await openAdmin('?tab=resume');
    route('POST resume/generate', () => ({ success: true, upToDate: true, version: '1' }));

    await pick('End month', 'Month');
    submitButton('Save Experiences').requestSubmit();
    await settle(8);
    expect(text()).toContain('Select both end month and year.');
    expect(toast()).toEqual({
        message: 'Please fix the errors below before saving.',
        type: 'error'
    });

    await pick('Start month', 'December');
    await pick('End month', 'January');
    await pick('End year', '2020');
    submitButton('Save Experiences').requestSubmit();
    await settle(8);
    expect(text()).toContain('End date must be on or after the start date.');

    await pick('End year', '2021');
    route('POST resume', () => failure('The resume is locked.', 423));
    submitButton('Save Experiences').requestSubmit();
    await settle(8);
    expect(toast()).toEqual({ message: 'The resume is locked.', type: 'error' });

    route('POST resume', () => ({ success: true }));
    submitButton('Save Education').requestSubmit();
    await settle(8);
    expect(toast().message).toBe('Resume entries saved.');
    expect(sent('POST', 'resume').at(-1)?.body).toMatchObject({
        experiences: [
            { start_month: 'December', end_month: 'January', end_year: 2021, sort_order: 1 },
            { currently_in: true, end_month: null, sort_order: 2 }
        ],
        education: [{ institution: 'Uni', sort_order: 1 }]
    });
});

for (const [tab, label, removed] of [
    ['resume', 'Delete Experience', 'Experience Entry #2'],
    ['resume', 'Delete Education', 'Education Entry #1'],
    ['skills', 'Delete Category', 'Category #2'],
    ['socials', 'Delete Social Link', 'Social #1'],
    ['funding', 'Delete Funding', 'Funding #1'],
    ['contact', 'Delete Contact', 'Contact #1']
] as const) {
    test(`${tab}: ${label} asks first, then removes the entry`, async () => {
        await openAdmin(`?tab=${tab}`);
        const before = buttons(label).length;
        buttons(label)[0]?.click();
        await settle();
        await click('Cancel');
        expect(buttons(label)).toHaveLength(before);

        buttons(label)[0]?.click();
        await settle();
        const title = { 'Delete Category': 'Delete Skill Category' }[label as string] ?? label;
        await confirmDialog(title);
        expect(buttons(label)).toHaveLength(before - 1);
        expect(text()).not.toContain(removed);
    });
}

test('pasting "Category: a, b" fills a skill category and merges its skills', async () => {
    await openAdmin('?tab=skills');
    const category = document.querySelector<HTMLInputElement>('#sk-cat-0');
    if (!category) throw new Error('No category field');

    expect(paste(category, 'Rust, Go').defaultPrevented).toBe(false);
    expect(paste(category, 'Systems: Rust, Zig').defaultPrevented).toBe(true);
    await settle(2);
    expect(category.value).toBe('Systems');
    expect(text()).toContain('Zig');

    const pills = document.querySelector<HTMLInputElement>('input#sk-list-0');
    if (!pills) throw new Error('No skills field');
    expect(paste(pills, '').defaultPrevented).toBe(false);
    expect(paste(pills, 'Tooling: Make, Just').defaultPrevented).toBe(true);
    await settle(2);
    expect(category.value).toBe('Tooling');
    expect(text()).toContain('Just');
    expect(paste(pills, 'Bazel, Nix').defaultPrevented).toBe(true);
    await settle(2);
    expect(text()).toContain('Nix');
});
