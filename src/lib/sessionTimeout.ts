export const SESSION_WARNING_SECONDS = 30;

const ANNOUNCE_AT = [30, 10, 5];

export type CountdownTone = 'normal' | 'warning' | 'danger';

export function remainingSeconds(deadline: number, now: number) {
    return Math.max(0, Math.ceil((deadline - now) / 1000));
}

export function formatCountdown(seconds: number) {
    const total = Math.max(0, Math.floor(seconds));
    const minutes = Math.floor(total / 60);
    return `${minutes}:${String(total % 60).padStart(2, '0')}`;
}

export function countdownTone(seconds: number): CountdownTone {
    if (seconds <= 5) return 'danger';
    if (seconds <= 10) return 'warning';
    return 'normal';
}

export function shouldAnnounce(seconds: number) {
    return ANNOUNCE_AT.includes(seconds);
}

export function extendedTimeoutMinutes(baseMs: number, multiplier: number, maxMultiplier: number) {
    return Math.round((baseMs * Math.min(multiplier * 2, maxMultiplier)) / 60000);
}
