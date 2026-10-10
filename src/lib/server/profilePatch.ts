export const profileFields = [
    'name',
    'username',
    'headline',
    'job_title',
    'bio',
    'email',
    'city',
    'postal_code',
    'country',
    'site_url',
    'pronunciation'
] as const;

export class ProfileInputError extends Error {
    public fields: Record<string, string>;

    constructor(fields: Record<string, string>) {
        super(Object.values(fields)[0]);
        this.fields = fields;
    }
}

function hasControlChars(str: string): boolean {
    for (let i = 0; i < str.length; i++) {
        const code = str.charCodeAt(i);
        if (
            code <= 0x08
            || code === 0x0b
            || code === 0x0c
            || (code >= 0x0e && code <= 0x1f)
            || code === 0x7f
        ) {
            return true;
        }
    }
    return false;
}

export function profilePatch(
    payload: Record<string, unknown>,
    current: Record<string, unknown> | null
) {
    const allowed = new Set<string>([...profileFields, 'id', 'revision', 'manifest_settings']);
    if (Object.keys(payload).some(key => !allowed.has(key)))
        throw new ProfileInputError({ profile: 'Unknown profile field.' });
    const patch: Record<string, unknown> = { id: payload.id, revision: payload.revision };
    const errors: Record<string, string> = {};
    for (const field of profileFields) {
        if (current && !(field in payload)) continue;
        const rawValue = field === 'pronunciation' ? (payload[field] ?? '') : payload[field];
        if (current && rawValue === current[field]) continue;
        if (typeof rawValue !== 'string') {
            errors[field] = `Invalid ${field.replaceAll('_', ' ')}.`;
            continue;
        }
        let value = field === 'pronunciation' ? rawValue : rawValue.trim();
        if (field === 'username') value = value.replace(/^@+/, '').replace(/\s+/g, '');
        const max =
            field === 'bio' ? 5000
            : field === 'site_url' ? 2048
            : 250;

        if ((!value && field !== 'pronunciation') || value.length > max || hasControlChars(value))
            errors[field] = `Invalid ${field.replaceAll('_', ' ')}.`;
        if (field === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value))
            errors[field] = 'Please enter a valid email address.';
        if (field === 'site_url') {
            try {
                const site = new URL(value);
                if (
                    !['https:', 'http:'].includes(site.protocol)
                    || site.username
                    || site.password
                    || site.pathname !== '/'
                    || site.search
                    || site.hash
                )
                    throw new Error();
                value = site.origin;
            } catch {
                errors[field] = 'Site URL must be an HTTP or HTTPS origin.';
            }
        }
        if (value !== current?.[field]) patch[field] = value;
    }
    if ('manifest_settings' in payload) {
        const settings = payload.manifest_settings;
        if (
            !settings
            || typeof settings !== 'object'
            || Array.isArray(settings)
            || Object.keys(settings).some(
                key => !['display', 'theme_color', 'background_color'].includes(key)
            )
            || !['standalone', 'minimal-ui', 'browser', 'fullscreen'].includes(
                String((settings as Record<string, unknown>).display)
            )
        ) {
            errors.manifest_settings = 'Invalid display setting.';
        }
    }
    if (
        (current?.manifest_settings as Record<string, unknown> | undefined)?.display
        !== 'standalone'
    )
        patch.manifest_settings = { display: 'standalone' };
    if (Object.keys(errors).length) throw new ProfileInputError(errors);
    return patch;
}
