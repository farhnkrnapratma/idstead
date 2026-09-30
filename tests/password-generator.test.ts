import {afterEach, expect, spyOn, test} from 'bun:test';
import {createHash} from 'node:crypto';
import words from '../src/lib/data/password-words.json';
import {
  DEFAULT_RANDOM_PASSWORD,
  DEFAULT_MEMORABLE_PASSWORD,
  PASSWORD_SYMBOLS,
  generatePassword,
  type PasswordGeneratorOptions
} from '../src/lib/passwordGenerator';
import {passwordPolicyError} from '../src/lib/passwordPolicy';

let randomSpy: ReturnType<typeof spyOn> | undefined;
afterEach(() => randomSpy?.mockRestore());

test('EFF word list preserves all original words and bounded lengths', () => {
  expect(words.length).toBe(1296);
  expect(new Set(words).size).toBe(1296);
  expect(words.every(word => /^[a-z-]{3,5}$/.test(word))).toBe(true);
  expect(createHash('sha256').update(words.join('\n')).digest('hex')).toBe(
    '3680fb8483e03eab3067f20ef8b8848a086006b25981b0df6c8bdc603c4ed55e'
  );
});

test('random generator covers every selected group and excludes disabled groups at all lengths', () => {
  for (let length = 15; length <= 64; length++) {
    for (let mask = 0; mask < 8; mask++) {
      const options = {
        ...DEFAULT_RANDOM_PASSWORD,
        length,
        uppercase: !!(mask & 1),
        numbers: !!(mask & 2),
        symbols: !!(mask & 4)
      };
      const password = generatePassword(options);
      expect(passwordPolicyError(password)).toBe('');
      expect(password.length).toBe(length);
      expect(/[a-z]/.test(password)).toBe(true);
      expect(/[A-Z]/.test(password)).toBe(options.uppercase);
      expect(/[0-9]/.test(password)).toBe(options.numbers);
      expect(
        Array.from(password).some(character =>
          PASSWORD_SYMBOLS.includes(character)
        )
      ).toBe(options.symbols);
    }
  }
});

test('memorable generator supports all word counts, capitalization, separators, and digit options', () => {
  const dictionary = new Set(words);
  for (const count of [8, 9, 10]) {
    for (const capitalize of [false, true]) {
      for (const separator of [' ', '-', '.'] as const) {
        for (const numbers of [false, true]) {
          const password = generatePassword({
            ...DEFAULT_MEMORABLE_PASSWORD,
            words: count,
            capitalize,
            separator,
            numbers
          });
          expect(passwordPolicyError(password)).toBe('');
          expect(/\d$/.test(password)).toBe(numbers);
          const phrase = password;
          const generatedWords = phrase
            .replaceAll(
              capitalize ? 'Yo-yo' : 'yo-yo',
              capitalize ? 'Yoyo' : 'yoyo'
            )
            .split(separator);
          expect(generatedWords.length).toBe(count);
          for (const generatedWord of generatedWords) {
            expect(/\d$/.test(generatedWord)).toBe(numbers);
            const word = numbers ? generatedWord.slice(0, -1) : generatedWord;
            expect(
              dictionary.has(word.toLowerCase().replace('yoyo', 'yo-yo'))
            ).toBe(true);
            expect(/^[A-Z]/.test(word)).toBe(capitalize);
          }
        }
      }
    }
  }
});

test('generator rejects unsupported options instead of truncating or silently changing them', () => {
  const invalid = [
    {...DEFAULT_RANDOM_PASSWORD, length: 14},
    {...DEFAULT_RANDOM_PASSWORD, length: 65},
    {...DEFAULT_RANDOM_PASSWORD, length: NaN},
    {...DEFAULT_RANDOM_PASSWORD, length: 15.5},
    {...DEFAULT_MEMORABLE_PASSWORD, words: 7},
    {...DEFAULT_MEMORABLE_PASSWORD, words: 11},
    {...DEFAULT_MEMORABLE_PASSWORD, separator: 'long-separator'},
    {mode: 'unknown'}
  ];
  for (const options of invalid)
    expect(() =>
      generatePassword(options as PasswordGeneratorOptions)
    ).toThrow();
});

test('random index sampling rejects the biased tail of Uint32 values', () => {
  let calls = 0;
  randomSpy = spyOn(crypto, 'getRandomValues').mockImplementation(
    (array: Uint32Array) => {
      array.fill(calls++ === 0 ? 0xffffffff : 1);
      return array;
    }
  );
  expect(
    generatePassword({
      ...DEFAULT_RANDOM_PASSWORD,
      length: 15,
      uppercase: false,
      numbers: false,
      symbols: false
    })
  ).toBe('b'.repeat(15));
  expect(calls).toBe(2);
});

test('crypto failure blocks generation without an insecure fallback', () => {
  randomSpy = spyOn(crypto, 'getRandomValues').mockImplementation(() => {
    throw new Error('Unavailable');
  });
  expect(() => generatePassword(DEFAULT_RANDOM_PASSWORD)).toThrow(
    'Unavailable'
  );
  expect(() => generatePassword(DEFAULT_MEMORABLE_PASSWORD)).toThrow(
    'Unavailable'
  );
});

test('ten numbered words are regenerated whole when the candidate exceeds 64 characters', () => {
  let calls = 0;
  randomSpy = spyOn(crypto, 'getRandomValues').mockImplementation(
    (array: Uint32Array) => {
      array.fill(calls++ === 0 ? 1 : 0);
      return array;
    }
  );
  const password = generatePassword({
    ...DEFAULT_MEMORABLE_PASSWORD,
    words: 10,
    numbers: true
  });
  expect(calls).toBe(2);
  expect(passwordPolicyError(password)).toBe('');
  const parts = password.split('-');
  expect(parts.length).toBe(10);
  expect(parts.every(part => /^(acorn1|acid0)$/.test(part))).toBe(true);
});

test('each word gets its own independently sampled digit', () => {
  randomSpy = spyOn(crypto, 'getRandomValues').mockImplementation(
    (array: Uint32Array) => {
      for (let index = 0; index < array.length; index++)
        array[index] = index % 2 ? Math.floor(index / 2) % 10 : 0;
      return array;
    }
  );
  expect(generatePassword({...DEFAULT_MEMORABLE_PASSWORD, numbers: true})).toBe(
    'acid0-acid1-acid2-acid3-acid4-acid5-acid6-acid7'
  );
});
