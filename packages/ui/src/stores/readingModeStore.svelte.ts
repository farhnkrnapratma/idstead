// SPDX-FileCopyrightText: 2026 Farhan Kurnia Pratama
//
// SPDX-License-Identifier: AGPL-3.0-only

let active = $state(false);

export const readingModeStore = {
    get active() {
        return active;
    },
    toggle() {
        active = !active;
    },
    enable() {
        active = true;
    },
    disable() {
        active = false;
    }
};
