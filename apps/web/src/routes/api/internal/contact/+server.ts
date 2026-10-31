// SPDX-FileCopyrightText: 2026 Farhan Kurnia Pratama
//
// SPDX-License-Identifier: AGPL-3.0-only

import { publicRepositories, serviceData } from '#lib/server/repositories.ts';
import type { RequestHandler } from './$types';
import { readPublicWrite } from '#lib/server/publicWrite.ts';
import type { AdminNotificationKind } from '@idstead/data';
import { apiError } from '#lib/server/apiError.ts';
import {
    contactMessageEmail,
    resendApiKey,
    sendEmail,
    senderAddress,
    type ContactKind
} from '#lib/server/subscribers.ts';
import { isValidTimeZone } from '@idstead/domain/formatters.ts';
import { describeUserAgent } from '@idstead/domain/userAgent.ts';

const MAX_NAME = 120;
const MAX_EMAIL = 254;
const MAX_URL = 2048;
const MAX_MESSAGE = 5000;

const EMAIL_RE = /^[^\s@,;<>"'()]+@[^\s@,;<>"'()]+\.[^\s@,;<>"'()]+$/;

type RequestGeo = { city?: unknown; country?: unknown; timezone?: unknown };

function senderTimeZone(claimed: unknown, geo: RequestGeo | undefined): string {
    if (typeof claimed === 'string' && isValidTimeZone(claimed)) return claimed;
    if (typeof geo?.timezone === 'string' && isValidTimeZone(geo.timezone)) return geo.timezone;
    return 'UTC';
}

function senderLocation(geo: RequestGeo | undefined): string | null {
    const city = typeof geo?.city === 'string' ? geo.city.trim().slice(0, 100) : '';
    const code = typeof geo?.country === 'string' ? geo.country.trim().toUpperCase() : '';
    let country = '';
    if (/^[A-Z]{2}$/.test(code)) {
        try {
            country = new Intl.DisplayNames(['en'], { type: 'region' }).of(code) ?? code;
        } catch {
            country = code;
        }
    }
    return [city, country].filter(Boolean).join(', ') || null;
}

const NOTIFICATION_KINDS: Record<ContactKind, AdminNotificationKind> = {
    message: 'contact_message',
    feedback: 'feedback_report'
};

async function resolveContactEmail(): Promise<string> {
    const [contactInfo, authorProfile] = await Promise.all([
        publicRepositories()
            .author.contactLinks()
            .catch(() => []),
        publicRepositories()
            .author.profile({ includeEmail: true })
            .catch(() => null)
    ]);
    const emailItem = contactInfo.find(
        c => c.platform.toLowerCase() === 'email' || c.href.startsWith('mailto:')
    );
    return emailItem ?
            (emailItem.displayValue || emailItem.href.replace(/^mailto:/i, '')).trim()
        :   (authorProfile?.email || '').trim();
}

export const POST: RequestHandler = async event => {
    const { request, url, platform } = event;
    const parsed = await readPublicWrite(event, 'CONTACT_TURNSTILE_FAILED');
    if (parsed.response) return parsed.response;
    const { body } = parsed;

    const kind: ContactKind =
        body?.kind === 'feedback' ? 'feedback'
        : body?.kind === 'message' ? 'message'
        : ('' as ContactKind);

    if (!kind) {
        return apiError(400, 'CONTACT_KIND_INVALID', 'kind must be "message" or "feedback".');
    }

    const name = typeof body?.name === 'string' ? body.name.trim().slice(0, MAX_NAME) : '';
    const email = typeof body?.email === 'string' ? body.email.trim().slice(0, MAX_EMAIL) : '';
    const message =
        typeof body?.message === 'string' ? body.message.trim().slice(0, MAX_MESSAGE) : '';
    const pageUrl = typeof body?.url === 'string' ? body.url.trim().slice(0, MAX_URL) : '';

    if (!name) {
        return apiError(400, 'CONTACT_NAME_REQUIRED', 'name is required.');
    }
    if (!email || !EMAIL_RE.test(email)) {
        return apiError(400, 'CONTACT_EMAIL_INVALID', 'email must be a valid email address.');
    }
    if (!message) {
        return apiError(400, 'CONTACT_MESSAGE_REQUIRED', 'message is required.');
    }
    if (kind === 'feedback' && !pageUrl) {
        return apiError(400, 'CONTACT_URL_REQUIRED', 'url is required for feedback reports.');
    }

    let contactEmail: string;
    try {
        contactEmail = await resolveContactEmail();
    } catch (err) {
        console.error('Failed to resolve contact email:', err);
        return apiError(
            500,
            'CONTACT_RECIPIENT_LOOKUP_FAILED',
            'Could not resolve the recipient address.'
        );
    }

    if (!contactEmail) {
        return apiError(503, 'CONTACT_UNAVAILABLE', 'Message submission is currently unavailable.');
    }

    const apiKey = resendApiKey(platform);
    const from = senderAddress(platform);
    if (!apiKey || !from) {
        return apiError(
            503,
            'CONTACT_DELIVERY_UNAVAILABLE',
            'Message delivery is not configured. Please try again later.'
        );
    }

    const geo = (request as Request & { cf?: RequestGeo }).cf;
    const delivered = await sendEmail(apiKey, from, {
        to: contactEmail,
        ...contactMessageEmail({
            kind,
            name,
            email,
            message,
            pageUrl: kind === 'feedback' ? pageUrl : undefined,
            sentAt: new Date(),
            timeZone: senderTimeZone(body?.timeZone, geo),
            location: senderLocation(geo),
            client: describeUserAgent(request.headers.get('user-agent')?.slice(0, 500)),
            site: url.origin,
            reference: crypto.randomUUID().replace(/-/g, '').slice(0, 8).toUpperCase()
        })
    });
    if (!delivered) {
        return apiError(502, 'CONTACT_DELIVERY_FAILED', 'The message could not be delivered.');
    }

    await serviceData(platform)
        ?.writers.notifications.notify(NOTIFICATION_KINDS[kind])
        .catch(error => {
            console.error('Failed to record admin notification:', error);
        });

    return Response.json({ success: true }, { status: 201 });
};
