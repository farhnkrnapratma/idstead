import words from './data/password-words.json';
import { passwordPolicyError, PASSWORD_MIN_LENGTH, PASSWORD_MAX_LENGTH } from './passwordPolicy';

export type RandomPasswordOptions = {
    mode: 'random';
    length: number;
    uppercase: boolean;
    numbers: boolean;
    symbols: boolean;
};

export type MemorablePasswordOptions = {
    mode: 'memorable';
    words: number;
    capitalize: boolean;
    separator: '-' | ' ' | '.';
    numbers: boolean;
};

export type PasswordGeneratorOptions = RandomPasswordOptions | MemorablePasswordOptions;

export const DEFAULT_RANDOM_PASSWORD: RandomPasswordOptions = {
    mode: 'random',
    length: 24,
    uppercase: true,
    numbers: true,
    symbols: true
};

export const DEFAULT_MEMORABLE_PASSWORD: MemorablePasswordOptions = {
    mode: 'memorable',
    words: 8,
    capitalize: false,
    separator: '-',
    numbers: false
};

export const PASSWORD_SYMBOLS = '!@#$%^&*()-_=+[]{};:,.?';

function randomPicker() {
    const values = new Uint32Array(64);
    let position = values.length;
    return (size: number) => {
        const ceiling = 2 ** 32 - (2 ** 32 % size);
        for (;;) {
            if (position === values.length) {
                crypto.getRandomValues(values);
                position = 0;
            }
            const value = values[position++];
            if (value < ceiling) return value % size;
        }
    };
}

function characterGroups(options: RandomPasswordOptions) {
    return [
        'abcdefghijklmnopqrstuvwxyz',
        options.uppercase ? 'ABCDEFGHIJKLMNOPQRSTUVWXYZ' : '',
        options.numbers ? '0123456789' : '',
        options.symbols ? PASSWORD_SYMBOLS : ''
    ].filter(Boolean);
}

function validateOptions(options: PasswordGeneratorOptions) {
    if (options.mode === 'random') {
        if (
            !Number.isInteger(options.length)
            || options.length < PASSWORD_MIN_LENGTH
            || options.length > PASSWORD_MAX_LENGTH
        )
            throw new Error('Choose a length from 15 to 64 characters.');
    } else if (options.mode === 'memorable') {
        if (
            !Number.isInteger(options.words)
            || options.words < 8
            || options.words > 10
            || !['-', ' ', '.'].includes(options.separator)
        )
            throw new Error('Choose 8 to 10 words and a supported separator.');
    } else {
        throw new Error('Choose a supported password type.');
    }
}

export function generatePassword(options: PasswordGeneratorOptions) {
    validateOptions(options);
    const pick = randomPicker();
    let password = '';
    if (options.mode === 'memorable') {
        for (let attempt = 0; attempt < 128; attempt++) {
            const candidate = Array.from({ length: options.words }, () => {
                const word = words[pick(words.length)];
                const formatted = options.capitalize ? word[0].toUpperCase() + word.slice(1) : word;
                return formatted + (options.numbers ? String(pick(10)) : '');
            }).join(options.separator);
            if (!passwordPolicyError(candidate)) {
                password = candidate;
                break;
            }
        }
    } else {
        const groups = characterGroups(options);
        const alphabet = groups.join('');
        for (let attempt = 0; attempt < 128; attempt++) {
            const candidate = Array.from(
                { length: options.length },
                () => alphabet[pick(alphabet.length)]
            ).join('');
            if (
                groups.every(group =>
                    Array.from(candidate).some(character => group.includes(character))
                )
            ) {
                password = candidate;
                break;
            }
        }
    }
    if (!password) throw new Error('Password generation failed. Try again.');
    const error = passwordPolicyError(password);
    if (error) throw new Error(error);
    return password;
}
