export function browserTimeZone() {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
}
function zonedDate(date: Date, timeZone: string) {
    return new Intl.DateTimeFormat('en-CA', {
        timeZone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
    }).format(date);
}
export function zonedMidnight(day: string, timeZone: string) {
    const target = Date.parse(`${day}T00:00:00Z`);
    if (!Number.isFinite(target)) throw new Error('Choose valid dates.');
    let value = target;
    for (let attempt = 0; attempt < 3; attempt++) {
        const parts = new Intl.DateTimeFormat('en-CA', {
            timeZone,
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hourCycle: 'h23'
        }).formatToParts(new Date(value));
        const part = (key: string) => parts.find(p => p.type === key)?.value;
        const local = Date.parse(
            `${part('year')}-${part('month')}-${part('day')}T${part('hour')}:${part('minute')}:${part('second')}Z`
        );
        value += target - local;
    }
    return new Date(value).toISOString();
}
function shiftDay(day: string, count: number) {
    const value = new Date(`${day}T12:00:00Z`);
    value.setUTCDate(value.getUTCDate() + count);
    return value.toISOString().slice(0, 10);
}
export function analyticsPeriod(
    range: string,
    timeZone: string,
    now = new Date(),
    start?: string,
    end?: string
) {
    if (range === 'all') return { range, timeZone, from: '', to: '' };
    const today = zonedDate(now, timeZone);
    if (range === 'custom') {
        if (!start || !end || start > end || end > today)
            throw new Error('Choose valid start and end dates, no later than today.');
        const from = zonedMidnight(start, timeZone);
        const to = end === today ? now.toISOString() : zonedMidnight(shiftDay(end, 1), timeZone);
        const earliest = new Date(to);
        earliest.setUTCFullYear(earliest.getUTCFullYear() - 1);
        if (Date.parse(from) < earliest.getTime())
            throw new Error('Choose a period of up to one year.');
        return { range, timeZone, from, to };
    }
    let from: string;
    if (range === '1d') from = new Date(now.getTime() - 86400000).toISOString();
    else if (range === '1y') {
        const previous = new Date(now);
        previous.setUTCFullYear(previous.getUTCFullYear() - 1);
        from = previous.toISOString();
    } else from = zonedMidnight(shiftDay(today, -(Number(range.replace('d', '')) - 1)), timeZone);
    return { range, timeZone, from, to: now.toISOString() };
}
