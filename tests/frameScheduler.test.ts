import { describe, expect, test } from 'bun:test';
import { createFrameScheduler } from '../packages/lib/src/utils/frameScheduler';

describe('animation frame scheduler', () => {
    test('coalesces same-frame events into one callback', () => {
        let nextFrameId = 0;
        let callback: FrameRequestCallback | undefined;
        let updates = 0;
        const scheduler = createFrameScheduler(
            () => updates++,
            frameCallback => {
                callback = frameCallback;
                return ++nextFrameId;
            },
            () => {}
        );

        for (let i = 0; i < 100; i++) scheduler.schedule();

        expect(nextFrameId).toBe(1);
        expect(updates).toBe(0);
        callback?.(0);
        expect(updates).toBe(1);

        for (let i = 0; i < 100; i++) scheduler.schedule();
        expect(nextFrameId).toBe(2);
        callback?.(16);
        expect(updates).toBe(2);
    });

    test('cancels pending callbacks', () => {
        let cancelledFrameId: number | undefined;
        const scheduler = createFrameScheduler(
            () => {},
            () => 42,
            frameId => {
                cancelledFrameId = frameId;
            }
        );

        scheduler.schedule();
        scheduler.cancel();
        scheduler.cancel();

        expect(cancelledFrameId).toBe(42);
    });
});
