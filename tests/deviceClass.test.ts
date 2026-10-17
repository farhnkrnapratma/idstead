import { describe, expect, test } from 'bun:test';
import {
    classifyDevice,
    DESKTOP_MIN_LONG_SIDE,
    TABLET_MIN_SHORT_SIDE
} from '../packages/lib/src/deviceClass.ts';

describe('classifyDevice', () => {
    test('touch-primary screens split into phone and tablet by their short side', () => {
        expect(classifyDevice({ touchPrimary: true, screenWidth: 390, screenHeight: 844 })).toBe(
            'phone'
        );
        expect(classifyDevice({ touchPrimary: true, screenWidth: 844, screenHeight: 390 })).toBe(
            'phone'
        );
        expect(classifyDevice({ touchPrimary: true, screenWidth: 820, screenHeight: 1180 })).toBe(
            'tablet'
        );
        expect(classifyDevice({ touchPrimary: true, screenWidth: 1366, screenHeight: 1024 })).toBe(
            'tablet'
        );
    });

    test('fine-pointer screens split into laptop and desktop by their long side', () => {
        expect(classifyDevice({ touchPrimary: false, screenWidth: 1440, screenHeight: 900 })).toBe(
            'laptop'
        );
        expect(classifyDevice({ touchPrimary: false, screenWidth: 1536, screenHeight: 864 })).toBe(
            'laptop'
        );
        expect(classifyDevice({ touchPrimary: false, screenWidth: 1920, screenHeight: 1080 })).toBe(
            'desktop'
        );
        expect(classifyDevice({ touchPrimary: false, screenWidth: 1080, screenHeight: 1920 })).toBe(
            'desktop'
        );
    });

    test('missing or unusable signals fall back without throwing', () => {
        expect(classifyDevice(null)).toBe('desktop');
        expect(classifyDevice({ touchPrimary: false, screenWidth: 0, screenHeight: 0 })).toBe(
            'desktop'
        );
        expect(
            classifyDevice({ touchPrimary: true, screenWidth: Number.NaN, screenHeight: 0 })
        ).toBe('phone');
    });

    test('thresholds are inclusive at their exact boundary', () => {
        const short = TABLET_MIN_SHORT_SIDE;
        const long = DESKTOP_MIN_LONG_SIDE;
        expect(classifyDevice({ touchPrimary: true, screenWidth: short, screenHeight: 960 })).toBe(
            'tablet'
        );
        expect(
            classifyDevice({ touchPrimary: true, screenWidth: short - 1, screenHeight: 960 })
        ).toBe('phone');
        expect(classifyDevice({ touchPrimary: false, screenWidth: long, screenHeight: 900 })).toBe(
            'desktop'
        );
        expect(
            classifyDevice({ touchPrimary: false, screenWidth: long - 1, screenHeight: 900 })
        ).toBe('laptop');
    });
});
