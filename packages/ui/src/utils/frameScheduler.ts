export function createFrameScheduler(
    callback: () => void,
    requestFrame: (callback: FrameRequestCallback) => number = requestAnimationFrame,
    cancelFrame: (frameId: number) => void = cancelAnimationFrame
) {
    let frameId: number | undefined;

    return {
        schedule() {
            if (frameId !== undefined) return;

            frameId = requestFrame(() => {
                frameId = undefined;
                callback();
            });
        },
        cancel() {
            if (frameId === undefined) return;
            cancelFrame(frameId);
            frameId = undefined;
        }
    };
}
