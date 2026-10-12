import { httpServerIntegration, requestDataIntegration } from '@sentry/cloudflare';

export function privateRequestIntegrations() {
    return [
        httpServerIntegration({ maxRequestBodySize: 'none' }),
        requestDataIntegration({ include: { data: false } })
    ];
}
