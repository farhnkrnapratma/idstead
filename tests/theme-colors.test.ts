import {expect, test} from 'bun:test';
import {readFile} from 'node:fs/promises';
import {themeColors} from '../src/lib/themeColors';
import {publicResponse} from '../src/lib/server/publicResponse';

test('manifest colors follow the CSS tokens and yield distinct cache validators', async () => {
  const tokens = await readFile(
    new URL('../src/lib/tokens.css', import.meta.url),
    'utf8'
  );
  const light = tokens.match(/--color-background:\s*(#[0-9a-f]+)/)?.[1];
  const dark = tokens
    .slice(tokens.indexOf(':root.dark'))
    .match(/--color-background:\s*(#[0-9a-f]+)/)?.[1];
  if (!light || !dark) throw new Error('Missing theme tokens');
  expect(themeColors()).toEqual({theme_color: light, background_color: light});
  expect(themeColors('dark')).toEqual({
    theme_color: dark,
    background_color: dark
  });
  const response = await publicResponse(
    new Request('https://example.com/site.webmanifest?theme=light'),
    JSON.stringify(themeColors('light')),
    'application/manifest+json'
  );
  const other = await publicResponse(
    new Request('https://example.com/site.webmanifest?theme=dark', {
      headers: {'if-none-match': response.headers.get('etag')!}
    }),
    JSON.stringify(themeColors('dark')),
    'application/manifest+json'
  );
  expect(other.status).toBe(200);
  expect(other.headers.get('etag')).not.toBe(response.headers.get('etag'));
});
