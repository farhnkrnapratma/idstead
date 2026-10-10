export const PASSWORD_MIN_LENGTH = 15;
export const PASSWORD_MAX_LENGTH = 64;
export const PASSWORD_MAX_BYTES = 72;

export function passwordLength(password: string) {
    return Array.from(password).length;
}

export function passwordPolicyError(password: string) {
    const length = passwordLength(password);
    if (length < PASSWORD_MIN_LENGTH) return `Use at least ${PASSWORD_MIN_LENGTH} characters.`;
    if (length > PASSWORD_MAX_LENGTH) return `Use no more than ${PASSWORD_MAX_LENGTH} characters.`;
    if (new TextEncoder().encode(password).length > PASSWORD_MAX_BYTES)
        return 'This password exceeds the sign-in service’s 72-byte limit. Use fewer multi-byte characters.';
    return '';
}
