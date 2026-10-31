// SPDX-FileCopyrightText: 2026 Farhan Kurnia Pratama
//
// SPDX-License-Identifier: AGPL-3.0-only

import { tick } from 'svelte';

interface SubmitTarget {
    form?: SubmitForm | null;
    closest?: (selector: string) => unknown;
}

interface SubmitControl {
    tagName?: string;
    type?: string;
    disabled?: boolean;
}

export interface SubmitForm {
    elements: ArrayLike<SubmitControl>;
    isConnected?: boolean;
    requestSubmit?(submitter?: SubmitControl): void;
}

export interface SubmitKeyEvent {
    key: string;
    ctrlKey: boolean;
    metaKey: boolean;
    altKey: boolean;
    shiftKey: boolean;
    repeat: boolean;
    isComposing: boolean;
    keyCode?: number;
    defaultPrevented: boolean;
    target: unknown;
}

const IGNORED_TARGETS = [
    'button',
    'a[href]',
    'summary',
    '[role="button"]',
    'input[type="submit"]',
    'input[type="button"]',
    'input[type="reset"]',
    '[contenteditable=""]',
    '[contenteditable="true"]',
    '[data-no-submit-shortcut]'
].join(', ');

export function isSubmitChord(e: SubmitKeyEvent) {
    return (
        e.key === 'Enter'
        && (e.ctrlKey || e.metaKey)
        && !e.altKey
        && !e.shiftKey
        && !e.repeat
        && !e.isComposing
        && e.keyCode !== 229
    );
}

export function findSubmitter<T extends SubmitControl>(form: { elements: ArrayLike<T> }) {
    return Array.from(form.elements).find(control => {
        const submits =
            (control.tagName === 'BUTTON' || control.tagName === 'INPUT')
            && control.type === 'submit';
        return submits && !control.disabled;
    });
}

export function resolveSubmit(e: SubmitKeyEvent) {
    if (e.defaultPrevented || !isSubmitChord(e)) return null;
    const target = e.target as SubmitTarget | null;
    if (!target || typeof target.closest !== 'function') return null;
    if (target.closest(IGNORED_TARGETS)) return null;
    const form = target.form ?? (target.closest('form') as SubmitForm | null | undefined);
    if (!form) return null;
    const submitter = findSubmitter(form);
    return submitter ? { form, submitter } : null;
}

let pending = false;

async function submitForm(form: SubmitForm) {
    const active = document.activeElement as HTMLElement | null;
    if (active && active !== document.body) active.blur();
    await tick();
    const submitter = form.isConnected === false ? undefined : findSubmitter(form);
    if (submitter) form.requestSubmit?.(submitter);
    if (active?.isConnected && document.activeElement === document.body) active.focus();
}

export function installSubmitShortcut(target: Window = window) {
    const onKeydown = (event: KeyboardEvent) => {
        const match = resolveSubmit(event);
        if (!match || pending) return;
        event.preventDefault();
        pending = true;
        void submitForm(match.form).finally(() => {
            pending = false;
        });
    };
    target.addEventListener('keydown', onKeydown, true);
    return () => target.removeEventListener('keydown', onKeydown, true);
}
