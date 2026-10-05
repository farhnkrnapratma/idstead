import type {SupabaseClient} from '@supabase/supabase-js';
import {env as privateEnv} from '$env/dynamic/private';

export const SUBSCRIBER_TABLE = 'db_subscribers';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function normalizeEmail(value: unknown): string {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

export function isValidEmail(value: string): boolean {
  return value.length <= 254 && EMAIL_RE.test(value);
}

export function createToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
}

export async function hashToken(token: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(token)
  );
  return Array.from(new Uint8Array(digest), b =>
    b.toString(16).padStart(2, '0')
  ).join('');
}

export async function hashIp(ip: string, secret: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(ip + secret)
  );
  return Array.from(new Uint8Array(digest), b =>
    b.toString(16).padStart(2, '0')
  ).join('');
}

export function resendApiKey(platform: unknown): string {
  return (
    (platform as {env?: {RESEND_API_KEY?: string}} | undefined)?.env
      ?.RESEND_API_KEY
    ?? privateEnv.RESEND_API_KEY
    ?? process.env.RESEND_API_KEY
    ?? ''
  );
}

export function senderAddress(platform: unknown): string {
  return (
    (platform as {env?: {SUBSCRIBER_FROM_EMAIL?: string}} | undefined)?.env
      ?.SUBSCRIBER_FROM_EMAIL
    ?? privateEnv.SUBSCRIBER_FROM_EMAIL
    ?? process.env.SUBSCRIBER_FROM_EMAIL
    ?? ''
  );
}

export interface OutgoingEmail {
  to: string;
  subject: string;
  html: string;
  text: string;
  unsubscribeUrl?: string;
}

function payload(from: string, mail: OutgoingEmail) {
  return {
    from,
    to: [mail.to],
    subject: mail.subject,
    html: mail.html,
    text: mail.text,
    ...(mail.unsubscribeUrl ?
      {
        headers: {
          'List-Unsubscribe': `<${mail.unsubscribeUrl}>`,
          'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click'
        }
      }
    : {})
  };
}

export async function sendEmail(
  apiKey: string,
  from: string,
  mail: OutgoingEmail
): Promise<boolean> {
  if (!apiKey || !from) {
    console.error('RESEND_API_KEY or SUBSCRIBER_FROM_EMAIL is not configured.');
    return false;
  }
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload(from, mail))
    });
    if (!res.ok) {
      console.error('Resend send failed:', res.status, await res.text());
      return false;
    }
    return true;
  } catch (err) {
    console.error('Resend send request failed:', err);
    return false;
  }
}

export async function sendBatch(
  apiKey: string,
  from: string,
  mails: OutgoingEmail[]
): Promise<number> {
  if (!apiKey || !from || !mails.length) return 0;
  let sent = 0;
  for (let i = 0; i < mails.length; i += 100) {
    const chunk = mails.slice(i, i + 100);
    try {
      const res = await fetch('https://api.resend.com/emails/batch', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(chunk.map(mail => payload(from, mail)))
      });
      if (res.ok) {
        sent += chunk.length;
      } else {
        console.error('Resend batch failed:', res.status, await res.text());
      }
    } catch (err) {
      console.error('Resend batch request failed:', err);
    }
  }
  return sent;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function shell(body: string, footer: string): string {
  return `<!doctype html><html><body style="margin:0;padding:24px;background:#f2f5f3;font-family:system-ui,-apple-system,'Segoe UI',sans-serif;color:#101411">
<div style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:12px;padding:32px">
${body}
</div>
<div style="max-width:560px;margin:16px auto 0;font-size:12px;line-height:1.6;color:#6b736d;text-align:center">${footer}</div>
</body></html>`;
}

export function confirmEmail(
  siteName: string,
  confirmUrl: string
): Pick<OutgoingEmail, 'subject' | 'html' | 'text'> {
  const safeUrl = escapeHtml(confirmUrl);
  const safeName = escapeHtml(siteName);
  return {
    subject: `Confirm your subscription to ${siteName}`,
    html: shell(
      `<h1 style="margin:0 0 12px;font-size:20px">Confirm your subscription</h1>
<p style="margin:0 0 20px;font-size:15px;line-height:1.6;color:#3d443f">Click the button below to start receiving an email whenever a new article is published on ${safeName}.</p>
<p style="margin:0 0 20px"><a href="${safeUrl}" style="display:inline-block;background:#3094ff;color:#ffffff;text-decoration:none;padding:12px 20px;border-radius:8px;font-weight:600;font-size:15px">Confirm subscription</a></p>
<p style="margin:0;font-size:13px;line-height:1.6;color:#6b736d">If the button does not work, open this link:<br><a href="${safeUrl}" style="color:#3094ff;word-break:break-all">${safeUrl}</a></p>`,
      `You received this because someone entered this address on ${safeName}. If it was not you, ignore this email and nothing will happen.`
    ),
    text: `Confirm your subscription to ${siteName}\n\nOpen this link to start receiving new article notifications:\n${confirmUrl}\n\nIf you did not request this, ignore this email and nothing will happen.`
  };
}

export function unsubscribeEmail(
  siteName: string,
  unsubscribeUrl: string
): Pick<OutgoingEmail, 'subject' | 'html' | 'text'> {
  const safeUrl = escapeHtml(unsubscribeUrl);
  const safeName = escapeHtml(siteName);
  return {
    subject: `Confirm unsubscribing from ${siteName}`,
    html: shell(
      `<h1 style="margin:0 0 12px;font-size:20px">Confirm unsubscribe</h1><p>Open the link below to stop receiving new article notifications from ${safeName}.</p><p><a href="${safeUrl}">Unsubscribe</a></p>`,
      'If you did not request this, ignore this email. Your subscription will stay active.'
    ),
    text: `Confirm unsubscribing from ${siteName}\n\nOpen this link to unsubscribe:\n${unsubscribeUrl}\n\nIf you did not request this, ignore this email. Your subscription will stay active.`
  };
}

export function newPostEmail(
  siteName: string,
  post: {title: string; excerpt: string | null; url: string},
  unsubscribeUrl: string
): Pick<OutgoingEmail, 'subject' | 'html' | 'text'> {
  const safeTitle = escapeHtml(post.title);
  const safeUrl = escapeHtml(post.url);
  const safeName = escapeHtml(siteName);
  const safeUnsub = escapeHtml(unsubscribeUrl);
  const excerpt = post.excerpt?.trim() ? escapeHtml(post.excerpt.trim()) : '';
  return {
    subject: post.title,
    html: shell(
      `<h1 style="margin:0 0 12px;font-size:20px"><a href="${safeUrl}" style="color:#101411;text-decoration:none">${safeTitle}</a></h1>
${excerpt ? `<p style="margin:0 0 20px;font-size:15px;line-height:1.6;color:#3d443f">${excerpt}</p>` : ''}
<p style="margin:0"><a href="${safeUrl}" style="display:inline-block;background:#3094ff;color:#ffffff;text-decoration:none;padding:12px 20px;border-radius:8px;font-weight:600;font-size:15px">Read the article</a></p>`,
      `You are subscribed to new articles from ${safeName}. <a href="${safeUnsub}" style="color:#6b736d">Unsubscribe</a>.`
    ),
    text: `${post.title}\n\n${post.excerpt?.trim() ?? ''}\n\nRead it: ${post.url}\n\nUnsubscribe: ${unsubscribeUrl}`
  };
}

export function loginAlertEmail(
  siteName: string,
  details: {when: string; userAgent: string; ipHash: string; mfa: boolean}
): Pick<OutgoingEmail, 'subject' | 'html' | 'text'> {
  const rows = [
    ['When', details.when],
    ['Device', details.userAgent || 'Unknown'],
    ['IP fingerprint', details.ipHash],
    [
      'Second factor',
      details.mfa ? 'Required after this step' : 'Not configured'
    ]
  ];
  return {
    subject: `New sign-in to ${siteName} admin`,
    html: shell(
      `<h1 style="margin:0 0 12px;font-size:20px">A password sign-in just succeeded</h1>
<p style="margin:0 0 20px;font-size:15px;line-height:1.6;color:#3d443f">If this was you, nothing to do. If it was not, change the admin password immediately and enable two-factor authentication.</p>
<table style="width:100%;border-collapse:collapse;font-size:13px">${rows
        .map(
          ([label, value]) =>
            `<tr><td style="padding:6px 0;color:#6b736d;width:40%">${escapeHtml(label)}</td><td style="padding:6px 0;color:#101411">${escapeHtml(value)}</td></tr>`
        )
        .join('')}</table>`,
      'The IP fingerprint is a salted hash, not the address itself.'
    ),
    text: `A password sign-in to the ${siteName} admin just succeeded.\n\n${rows
      .map(([label, value]) => `${label}: ${value}`)
      .join(
        '\n'
      )}\n\nIf this was not you, change the admin password immediately.`
  };
}

export async function activeSubscribers(
  db: SupabaseClient
): Promise<{email: string; unsubscribe_token: string}[]> {
  const {data, error} = await db
    .from(SUBSCRIBER_TABLE)
    .select('email, unsubscribe_token')
    .eq('status', 'active');
  if (error) {
    console.error('Failed to load subscribers:', error);
    return [];
  }
  return data ?? [];
}
