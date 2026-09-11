import {S3Client, DeleteObjectCommand} from '@aws-sdk/client-s3';

const keys = [
  'hero.png',
  'favicon.ico',
  'favicon-16x16.png',
  'favicon-32x32.png',
  'apple-touch-icon.png',
  'android-chrome-192x192.png',
  'android-chrome-512x512.png',
  'site.webmanifest'
];

if (!Bun.argv.includes('--delete')) {
  console.log(
    JSON.stringify(
      {
        mode: 'dry-run',
        keys,
        next: 'After deployment approval, rerun with --delete --origin=https://your-production-origin. Production references are verified before any deletion.'
      },
      null,
      2
    )
  );
  process.exit(0);
}
const originArg = Bun.argv.find(arg => arg.startsWith('--origin='))?.slice(9);
if (!originArg) throw new Error('An explicit Production origin is required.');
const origin = new URL(originArg);
if (
  origin.protocol !== 'https:'
  || origin.username
  || origin.password
  || origin.pathname !== '/'
  || origin.search
  || origin.hash
  || origin.hostname.endsWith('.pages.dev')
)
  throw new Error('Use the HTTPS Production origin.');
const request = async (path: string) => {
  const response = await fetch(new URL(path, origin), {
    redirect: 'error',
    cache: 'no-store',
    signal: AbortSignal.timeout(15000)
  });
  if (!response.ok)
    throw new Error(
      `Production verification failed: ${path} (${response.status})`
    );
  return response;
};
const data = (await (await request('/api/v1/author?profile')).json()) as {
  profile: {avatar: string};
};
const avatar = new URL(data.profile.avatar);
const version = avatar.searchParams.get('v');
if (
  avatar.origin !== origin.origin
  || avatar.pathname !== '/avatar.png'
  || !version
  || !/^[0-9a-f-]{36}$/i.test(version)
)
  throw new Error('Production must expose the active versioned avatar.');
const manifest = (await (
  await request('/site.webmanifest?theme=light')
).json()) as {icons: {src: string}[]};
if (
  !manifest.icons.length
  || manifest.icons.some(
    icon => new URL(icon.src, origin).searchParams.get('v') !== version
  )
)
  throw new Error('Production manifest references are not current.');
for (const page of ['/', '/feedback']) {
  const html = await (await request(page)).text();
  for (const name of ['og:image', 'twitter:image']) {
    const tag = html.match(
      new RegExp(`<meta[^>]+(?:name|property)=["']${name}["'][^>]*>`, 'i')
    )?.[0];
    const content = tag
      ?.match(/content=["']([^"']+)["']/)?.[1]
      ?.replaceAll('&amp;', '&');
    if (content !== avatar.href)
      throw new Error(`Production ${page} ${name} is not the active avatar.`);
  }
}
const digest = async (response: Response) =>
  new Bun.CryptoHasher('sha256')
    .update(await response.arrayBuffer())
    .digest('hex');
if (
  (await digest(await request(avatar.pathname + avatar.search)))
  !== (await digest(await request('/hero.png')))
)
  throw new Error('The compatibility alias does not serve the active avatar.');
for (const icon of manifest.icons) await request(icon.src);
for (const name of keys.filter(
  key => !['hero.png', 'site.webmanifest'].includes(key)
))
  await request(`/${name}?v=${version}`);
const required = (key: string) => {
  const value = process.env[key];
  if (!value) throw new Error(`Missing ${key}`);
  return value;
};
const bucket = required('R2_BUCKET_NAME');
const client = new S3Client({
  region: 'auto',
  endpoint: `https://${required('R2_ACCOUNT_ID')}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: required('R2_ACCESS_KEY_ID'),
    secretAccessKey: required('R2_SECRET_ACCESS_KEY')
  }
});
for (const key of keys) {
  await client.send(new DeleteObjectCommand({Bucket: bucket, Key: key}));
  console.log(`Deleted legacy key: ${key}`);
}
