// SPDX-FileCopyrightText: 2026 Farhan Kurnia Pratama
//
// SPDX-License-Identifier: AGPL-3.0-only

import { handleErrorWithSentry, replayIntegration } from '@sentry/sveltekit';
import * as Sentry from '@sentry/sveltekit';
import * as env from '$app/env/public';

if (!Sentry.getClient()) {
    Sentry.init({
        dsn: env.PUBLIC_SENTRY_DSN || '',
        environment: env.PUBLIC_SENTRY_ENVIRONMENT || import.meta.env.MODE,
        tracesSampleRate: 1.0,
        replaysSessionSampleRate: 0.1,
        replaysOnErrorSampleRate: 1.0,
        integrations: [replayIntegration()],
        dataCollection: {}
    });
}

export const handleError = handleErrorWithSentry();
