import {expect, test} from 'bun:test';
import {fetchAuthorProfile} from '../src/lib/author';
import {
  generateAuthorMarkdown,
  sanitizePublicApiData
} from '../src/lib/authorApi';

test('profile reads, public JSON and Markdown preserve pronunciation delimiters', async () => {
  for (const pronunciation of [
    '/ˈælbərt ˈaɪnstaɪn/',
    '[ˈælbərt ˈaɪnstaɪn]',
    'ˈælbərt ˈaɪnstaɪn',
    ' [ˈælbərt ˈaɪnstaɪn] ',
    ''
  ]) {
    const query = {
      select: () => query,
      limit: () => query,
      maybeSingle: async () => ({
        data: {name: 'Example', pronunciation},
        error: null
      })
    };
    const profile = await fetchAuthorProfile({from: () => query});
    expect(profile?.pronunciation).toBe(pronunciation);
    const data = sanitizePublicApiData({profile});
    expect(data.profile.pronunciation).toBe(pronunciation);
    expect(generateAuthorMarkdown(data)).toContain(
      pronunciation ? `# Example (${pronunciation})\n` : '# Example\n'
    );
  }
});
