import {handleErrorWithSentry, replayIntegration} from '@sentry/sveltekit'
import * as Sentry from '@sentry/sveltekit'
import {PUBLIC_SENTRY_DSN} from '$env/static/public'
import {env} from '$env/dynamic/public'

Sentry.init({
  dsn: PUBLIC_SENTRY_DSN,
  environment: env.PUBLIC_SENTRY_ENVIRONMENT || import.meta.env.MODE,
  tracesSampleRate: 1.0,
  enableLogs: true,
  replaysSessionSampleRate: 0.1,
  replaysOnErrorSampleRate: 1.0,
  integrations: [replayIntegration()],
  dataCollection: {}
})

export const handleError = handleErrorWithSentry()
