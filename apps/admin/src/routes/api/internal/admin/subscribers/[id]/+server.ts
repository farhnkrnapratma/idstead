// SPDX-FileCopyrightText: 2026 Farhan Kurnia Pratama
//
// SPDX-License-Identifier: AGPL-3.0-only

import type { AdminSubscriber } from '@idstead/data';
import type { RequestHandler } from './$types';
import { logAdminActivity, requireSameOriginAdmin } from '#lib/server/adminRequest.ts';
import {
    isSubscriberId,
    sendSubscriberConfirmation,
    subscriberResponse
} from '#lib/server/adminSubscribers.ts';
import { apiError } from '#lib/server/apiError.ts';
import { dataStores, type ServiceStores } from '#lib/server/data.ts';

const notFound = () => apiError(404, 'SUBSCRIBER_NOT_FOUND', 'Subscriber not found.');
const unavailable = (error: unknown) => {
    console.error('Subscriber update failed:', error);
    return apiError(503, 'SUBSCRIBERS_UNAVAILABLE', 'Subscribers are unavailable right now.');
};

type Event = Parameters<RequestHandler>[0];
type Subscriber = AdminSubscriber;

const STATUS_CHANGES = {
    active: {
        action: 'newsletter.subscriber_activate',
        summary: 'Reactivated a newsletter subscriber.',
        conflict:
            'Only unsubscribed subscribers who confirmed before can be reactivated. Add the address again to send a confirmation.'
    },
    unsubscribed: {
        action: 'newsletter.subscriber_unsubscribe',
        summary: 'Unsubscribed a newsletter subscriber.',
        conflict: 'Only active subscribers can be unsubscribed.'
    }
} as const;

function log(event: Event, action: string, entityId: string, summary: string) {
    return logAdminActivity(
        event.request,
        event.platform,
        { action, category: 'blog', entityId, summary },
        event.getClientAddress
    );
}

async function resend(event: Event, service: ServiceStores, subscriber: Subscriber) {
    if (subscriber.status !== 'pending')
        return apiError(
            409,
            'SUBSCRIBER_NOT_PENDING',
            'Only pending subscribers can get a new confirmation email.'
        );
    const failed = await sendSubscriberConfirmation(
        service.writers.subscribers,
        event.platform,
        subscriber.email
    );
    if (failed) return failed;
    await log(
        event,
        'newsletter.subscriber_resend',
        subscriber.id,
        'Resent a newsletter confirmation.'
    );
    return subscriberResponse(subscriber);
}

async function changeStatus(
    event: Event,
    service: ServiceStores,
    id: string,
    status: keyof typeof STATUS_CHANGES
) {
    const change = STATUS_CHANGES[status];
    let updated: Subscriber | null;
    try {
        updated = await service.adminSubscribers.setStatus(id, status);
    } catch (error) {
        return unavailable(error);
    }
    if (!updated) return apiError(409, 'SUBSCRIBER_STATUS_CONFLICT', change.conflict);
    await log(event, change.action, updated.id, change.summary);
    return subscriberResponse(updated);
}

export const PATCH: RequestHandler = async event => {
    const { request, url, params, platform } = event;
    const denied = await requireSameOriginAdmin(request, url, platform);
    if (denied) return denied;
    if (!isSubscriberId(params.id)) return notFound();

    const body = (await request.json().catch(() => null)) as {
        status?: unknown;
        action?: unknown;
    } | null;
    const service = dataStores(platform).service;
    let subscriber: Subscriber | null;
    try {
        subscriber = await service.adminSubscribers.byId(params.id);
    } catch (error) {
        return unavailable(error);
    }
    if (!subscriber) return notFound();
    if (body?.action === 'resend') return resend(event, service, subscriber);
    if (body?.status === 'active' || body?.status === 'unsubscribed')
        return changeStatus(event, service, params.id, body.status);
    return apiError(
        400,
        'SUBSCRIBER_UPDATE_INVALID',
        "Send { status: 'active' | 'unsubscribed' } or { action: 'resend' }."
    );
};

export const DELETE: RequestHandler = async ({
    request,
    url,
    params,
    platform,
    getClientAddress
}) => {
    const denied = await requireSameOriginAdmin(request, url, platform);
    if (denied) return denied;
    if (!isSubscriberId(params.id)) return notFound();

    let result: 'deleted' | 'not-found';
    try {
        result = await dataStores(platform).service.adminSubscribers.delete(params.id);
    } catch (error) {
        return unavailable(error);
    }
    if (result === 'not-found') return notFound();
    await logAdminActivity(
        request,
        platform,
        {
            action: 'newsletter.subscriber_delete',
            category: 'blog',
            entityId: params.id,
            summary: 'Deleted a newsletter subscriber.'
        },
        getClientAddress
    );
    return new Response(null, { status: 204 });
};
