// SPDX-FileCopyrightText: 2026 Farhan Kurnia Pratama
//
// SPDX-License-Identifier: AGPL-3.0-only

export type FilterToolbarControlSize = 'sm' | 'md';

export type FilterToolbarContext = {
    get controlSize(): FilterToolbarControlSize;
    get stackOnMobile(): boolean;
};

export const FILTER_TOOLBAR_CONTROL_SIZE = Symbol('filterToolbarControlSize');
