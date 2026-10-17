import { classifyDevice, type DeviceClass } from '#lib/deviceClass.ts';

const TOUCH_PRIMARY_QUERY = '(hover: none) and (pointer: coarse)';

let current = $state<DeviceClass>('desktop');

export const deviceClassStore = {
    get current() {
        return current;
    },
    init() {
        if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;
        const touch = window.matchMedia(TOUCH_PRIMARY_QUERY);
        const update = () => {
            current = classifyDevice({
                touchPrimary: touch.matches,
                screenWidth: window.screen?.width ?? 0,
                screenHeight: window.screen?.height ?? 0
            });
        };
        update();
        touch.addEventListener('change', update);
        window.addEventListener('resize', update);
        return () => {
            touch.removeEventListener('change', update);
            window.removeEventListener('resize', update);
        };
    }
};
