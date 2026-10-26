const BROWSERS: [string, RegExp][] = [
    ['Edge', /Edg(?:A|iOS)?\/(\d+)/],
    ['Opera', /OPR\/(\d+)/],
    ['Firefox', /(?:Firefox|FxiOS)\/(\d+)/],
    ['Chrome', /(?:Chrome|CriOS)\/(\d+)/],
    ['Safari', /Version\/(\d+)[^ ]* (?:Mobile\/\S+ )?Safari\//]
];

const SYSTEMS: [string, RegExp][] = [
    ['iPadOS', /\biPad\b/],
    ['iOS', /\b(?:iPhone|iPod)\b/],
    ['Android', /\bAndroid\b/],
    ['ChromeOS', /\bCrOS\b/],
    ['Windows', /\bWindows\b/],
    ['macOS', /\bMacintosh\b|\bMac OS X\b/],
    ['Linux', /\bLinux\b/]
];

export function describeUserAgent(agent: string | null | undefined): string | null {
    if (!agent) return null;
    const system = SYSTEMS.find(([, pattern]) => pattern.test(agent))?.[0];
    for (const [name, pattern] of BROWSERS) {
        const version = agent.match(pattern)?.[1];
        if (version) return system ? `${name} ${version} on ${system}` : `${name} ${version}`;
    }
    return system ? `Unknown browser on ${system}` : null;
}
