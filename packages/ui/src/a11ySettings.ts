export type FontScale = 100 | 110 | 120 | 130 | 140 | 150;

export interface A11ySettings {
    reduceMotion: boolean;
    highContrast: boolean;
    fontScale: FontScale;
    focusHighlight: boolean;
    dyslexicFont: boolean;
}

export type A11yToggleKey = Exclude<keyof A11ySettings, 'fontScale'>;

export const A11Y_STORAGE_KEY = 'a11y_overrides';

export const A11Y_DEFAULTS: A11ySettings = {
    reduceMotion: false,
    highContrast: false,
    fontScale: 100,
    focusHighlight: false,
    dyslexicFont: false
};

export const A11Y_SYSTEM_QUERIES: Partial<Record<A11yToggleKey, string>> = {
    reduceMotion: '(prefers-reduced-motion: reduce)',
    highContrast: '(prefers-contrast: more)'
};

const FONT_SCALES: readonly FontScale[] = [100, 110, 120, 130, 140, 150];
const TOGGLE_KEYS = Object.keys(A11Y_DEFAULTS).filter(
    (key): key is A11yToggleKey => key !== 'fontScale'
);

export function isFontScale(value: unknown): value is FontScale {
    return FONT_SCALES.includes(value as FontScale);
}

export function parseOverrides(raw: string | null): Partial<A11ySettings> {
    if (!raw) return {};
    let parsed: unknown;
    try {
        parsed = JSON.parse(raw);
    } catch {
        return {};
    }
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return {};

    const source = parsed as Record<string, unknown>;
    const overrides: Partial<A11ySettings> = {};
    for (const key of TOGGLE_KEYS) {
        if (typeof source[key] === 'boolean') overrides[key] = source[key];
    }
    if (isFontScale(source.fontScale)) overrides.fontScale = source.fontScale;
    return overrides;
}

export function resolveSettings(
    system: Partial<A11ySettings>,
    overrides: Partial<A11ySettings>
): A11ySettings {
    return { ...A11Y_DEFAULTS, ...system, ...overrides };
}
