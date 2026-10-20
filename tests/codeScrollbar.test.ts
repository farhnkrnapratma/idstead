import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { createCodeScrollbar } from '../packages/mdrs-dom/src/codeScrollbar.ts';

function fakeElement() {
    const children: unknown[] = [];
    return {
        className: '',
        style: {} as Record<string, string>,
        children,
        isConnected: true,
        appendChild: (child: unknown) => children.push(child),
        addEventListener: () => {},
        removeEventListener: () => {},
        getBoundingClientRect: () => ({ left: 0, width: 100 })
    };
}

const globals = globalThis as Record<string, unknown>;
const saved = { document: globals.document, window: globals.window };

beforeAll(() => {
    globals.document = { createElement: fakeElement, body: { style: {} } };
    globals.window = { addEventListener: () => {}, removeEventListener: () => {} };
});

afterAll(() => {
    for (const [key, value] of Object.entries(saved))
        if (value === undefined) delete globals[key];
        else globals[key] = value;
});

function scroller(scrollWidth: number, clientWidth = 200) {
    return { ...fakeElement(), scrollWidth, clientWidth, scrollLeft: 0 } as unknown as HTMLElement;
}

const parts = (bar: ReturnType<typeof createCodeScrollbar>) => {
    const wrapper = bar.element as unknown as ReturnType<typeof fakeElement>;
    const track = wrapper.children[0] as ReturnType<typeof fakeElement>;
    return { wrapper, track, thumb: track.children[0] as ReturnType<typeof fakeElement> };
};

describe('code scrollbar', () => {
    test('reserve mode keeps the track when nothing overflows', () => {
        const bar = createCodeScrollbar(scroller(200), { reserve: true });
        bar.update();
        const { wrapper, thumb, track } = parts(bar);
        expect(wrapper.style.display).toBe('flex');
        expect(thumb.style.visibility).toBe('hidden');
        expect(track.style.backgroundColor).toBe('transparent');
    });

    test('reserve mode shows the thumb when the code overflows', () => {
        const bar = createCodeScrollbar(scroller(400), { reserve: true });
        bar.update();
        const { wrapper, thumb } = parts(bar);
        expect(wrapper.style.display).toBe('flex');
        expect(thumb.style.visibility).toBe('');
        expect(thumb.style.width).toBe('50%');
    });

    test('standalone blocks still collapse without overflow', () => {
        const bar = createCodeScrollbar(scroller(200));
        bar.update();
        expect(parts(bar).wrapper.style.display).toBe('none');
    });

    test('suppressed blocks collapse even in reserve mode', () => {
        const bar = createCodeScrollbar(scroller(400), { reserve: true, suppressed: () => true });
        bar.update();
        expect(parts(bar).wrapper.style.display).toBe('none');
    });
});
