// SPDX-FileCopyrightText: 2026 Farhan Kurnia Pratama
//
// SPDX-License-Identifier: AGPL-3.0-only

export type DeviceClass = 'desktop' | 'laptop' | 'tablet' | 'phone';

export interface DeviceSignals {
    touchPrimary: boolean;
    screenWidth: number;
    screenHeight: number;
}

export const TABLET_MIN_SHORT_SIDE = 600;
export const DESKTOP_MIN_LONG_SIDE = 1680;

export function classifyDevice(signals: DeviceSignals | null | undefined): DeviceClass {
    if (!signals) return 'desktop';
    const { touchPrimary, screenWidth, screenHeight } = signals;
    if (!(screenWidth > 0) || !(screenHeight > 0)) return touchPrimary ? 'phone' : 'desktop';
    if (touchPrimary) {
        return Math.min(screenWidth, screenHeight) >= TABLET_MIN_SHORT_SIDE ? 'tablet' : 'phone';
    }
    return Math.max(screenWidth, screenHeight) >= DESKTOP_MIN_LONG_SIDE ? 'desktop' : 'laptop';
}
