// SPDX-FileCopyrightText: 2026 Farhan Kurnia Pratama
//
// SPDX-License-Identifier: AGPL-3.0-only

import { getContext } from 'svelte';
import type { FormFieldContext } from '../types';

type FieldVariant = NonNullable<FormFieldContext['variant']>;

interface FieldProps {
    variant?: FieldVariant;
    label?: string;
    required?: boolean;
    hideAsterisk?: boolean;
}

export function resolveFormField(props: () => FieldProps, defaultVariant: FieldVariant) {
    const context = getContext<FormFieldContext | undefined>('formField');
    const label = $derived(props().label || context?.label || '');
    const required = $derived(props().required ?? context?.required ?? false);
    const hideAsterisk = $derived(props().hideAsterisk ?? context?.hideAsterisk ?? false);
    const isFloating = $derived(
        (props().variant ?? context?.variant ?? defaultVariant) === 'floating'
    );
    return {
        context,
        get label() {
            return label;
        },
        get required() {
            return required;
        },
        get hideAsterisk() {
            return hideAsterisk;
        },
        get isFloating() {
            return isFloating;
        },
        get counter() {
            return context?.counter ?? '';
        }
    };
}
