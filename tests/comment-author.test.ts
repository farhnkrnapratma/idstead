import {expect, test} from 'bun:test';
import {commentAuthorName} from '../src/lib/commentAuthor';

test('admin names use the site author even for legacy anonymous records', () => {
  for (const author_name of ['Admin', 'Administrator', 'Anonymous', null]) {
    expect(
      commentAuthorName(
        {is_admin: true, is_anonymous: true, author_name},
        'Example Author'
      )
    ).toBe('Example Author');
  }
  expect(
    commentAuthorName({is_admin: true, author_name: 'Historical Author'}, '')
  ).toBe('Historical Author');
  expect(
    commentAuthorName({is_admin: true, author_name: 'Administrator'}, '')
  ).toBe('');
});

test('ordinary and anonymous comments keep their existing identity', () => {
  expect(commentAuthorName({author_name: 'Reader'}, 'Example Author')).toBe(
    'Reader'
  );
  expect(
    commentAuthorName(
      {author_name: 'Private', is_anonymous: true},
      'Example Author'
    )
  ).toBe('Anonymous');
  expect(commentAuthorName({author_name: null}, 'Example Author')).toBe(
    'Anonymous'
  );
});
