import {test} from 'bun:test';
import {countReadingMinutes, estimateReadTime} from '../src/lib/readTime';

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message);
}

test('reading time counts Latin, Japanese, Chinese, Hangul and short text', () => {
  const english = 'word '.repeat(400).trim();
  assert(
    countReadingMinutes(english) === 2,
    `400 English words should read as 2 minutes, got ${countReadingMinutes(english)}`
  );

  const japanese = 'これは日本語の文章です。'.repeat(100);
  assert(
    countReadingMinutes(japanese) >= 3,
    `1200 Japanese characters should exceed 1 minute, got ${countReadingMinutes(japanese)}`
  );

  const chinese = '这是一段中文内容。'.repeat(100);
  assert(
    countReadingMinutes(chinese) >= 2,
    `900 Chinese characters should exceed 1 minute, got ${countReadingMinutes(chinese)}`
  );

  const korean = '한국어 문장 입니다 '.repeat(100).trim();
  assert(
    countReadingMinutes(korean) === 2,
    `Hangul is space separated and must be counted as words, got ${countReadingMinutes(korean)}`
  );

  assert(countReadingMinutes('') === 1, 'empty text should floor at 1 minute');
  assert(
    estimateReadTime('one word') === '1 min read',
    'single minute must not be pluralised'
  );
});
