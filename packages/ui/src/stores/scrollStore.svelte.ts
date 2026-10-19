import { browser } from '$app/env';
import { createFrameScheduler } from '../utils/frameScheduler.ts';

function createScrollStore() {
    let progress = $state(0);
    let pastThreshold = $state(false);

    function init() {
        if (!browser) return;

        const updateScrollState = () => {
            const scrollY = window.scrollY;
            pastThreshold = scrollY > 300;
            const docHeight = document.documentElement.scrollHeight - window.innerHeight;
            progress = docHeight > 0 ? (scrollY / docHeight) * 100 : 0;
        };
        const scheduleUpdate = createFrameScheduler(updateScrollState);

        scheduleUpdate.schedule();
        window.addEventListener('scroll', scheduleUpdate.schedule, { passive: true });
        window.addEventListener('resize', scheduleUpdate.schedule, { passive: true });

        return () => {
            window.removeEventListener('scroll', scheduleUpdate.schedule);
            window.removeEventListener('resize', scheduleUpdate.schedule);
            scheduleUpdate.cancel();
        };
    }

    return {
        get progress() {
            return progress;
        },
        get pastThreshold() {
            return pastThreshold;
        },
        init
    };
}

export const scrollStore = createScrollStore();
