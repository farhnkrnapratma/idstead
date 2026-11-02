// SPDX-FileCopyrightText: 2026 Farhan Kurnia Pratama
//
// SPDX-License-Identifier: AGPL-3.0-only

(() => {
    const root = document.documentElement;
    const read = key => {
        try {
            const parsed = JSON.parse(localStorage.getItem(key) || 'null');
            return parsed && typeof parsed === 'object' ? parsed : null;
        } catch {
            return null;
        }
    };
    const overrides = read('a11y_overrides') || {};
    const device = query => {
        const list = window.matchMedia(query);
        return list.media !== 'not all' && list.matches;
    };
    const pick = (key, query) =>
        typeof overrides[key] === 'boolean' ? overrides[key]
        : query ? device(query)
        : false;
    root.setAttribute(
        'data-reduce-motion',
        String(pick('reduceMotion', '(prefers-reduced-motion: reduce)'))
    );
    root.setAttribute(
        'data-high-contrast',
        String(pick('highContrast', '(prefers-contrast: more)'))
    );
    root.setAttribute('data-focus-highlight', String(pick('focusHighlight')));
    root.setAttribute('data-dyslexic-font', String(pick('dyslexicFont')));
    root.setAttribute(
        'data-font-scale',
        String(
            [100, 110, 120, 130, 140, 150].includes(overrides.fontScale) ? overrides.fontScale : 100
        )
    );
})();
