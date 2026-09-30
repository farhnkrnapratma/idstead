import assert from 'node:assert/strict';
import * as sentry from '@sentry/sveltekit';
import type {RequestEvent} from '@sveltejs/kit';
import {privateRequestIntegrations} from '../../src/lib/server/sentryPrivacy';

const envelopes: unknown[] = [];
const pending: Promise<unknown>[] = [];
const initCloudflareSentryHandle = sentry.initCloudflareSentryHandle;

assert.match(String(initCloudflareSentryHandle), /wrapRequestHandler/);

const initialize = initCloudflareSentryHandle({
  dsn: 'https://fixture@example.invalid/1',
  environment: 'production',
  tracesSampleRate: 1,
  enableLogs: true,
  skipOpenTelemetrySetup: true,
  integrations: privateRequestIntegrations(),
  transport: () => ({
    send: async envelope => {
      envelopes.push(envelope);
      return {};
    },
    flush: async () => true
  })
});
const instrument = sentry.sentryHandle();

for (const pathname of [
  '/api/internal/admin/password',
  '/api/internal/admin/login'
]) {
  for (const failure of [false, true]) {
    envelopes.length = 0;
    const url = new URL(`https://fixture.example${pathname}`);
    const secrets = {
      password: 'fixture-new-password-do-not-transmit',
      currentPassword: 'fixture-old-password-do-not-transmit'
    };
    const request = new Request(url, {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify(secrets)
    });
    let requestClones = 0;
    const clone = request.clone.bind(request);
    request.clone = () => {
      requestClones++;
      return clone();
    };
    const event = {
      request,
      url,
      route: {id: pathname},
      locals: {},
      platform: {
        context: {
          waitUntil: (promise: Promise<unknown>) => pending.push(promise),
          passThroughOnException: () => {}
        }
      },
      getClientAddress: () => '192.0.2.1'
    } as unknown as RequestEvent;

    await initialize({
      event,
      resolve: currentEvent =>
        instrument({
          event: currentEvent,
          resolve: async () => {
            assert.deepEqual(await request.json(), secrets);
            if (failure) {
              sentry
                .getIsolationScope()
                .setSDKProcessingMetadata({
                  normalizedRequest: {data: JSON.stringify(secrets)}
                });
              sentry.captureException(
                new Error('Fixture infrastructure failure')
              );
            }
            return new Response(null, {status: failure ? 503 : 200});
          }
        })
    });
    await Promise.all(pending.splice(0));

    assert.equal(requestClones, 0);
    assert.ok(envelopes.length > 0);
    const wire = JSON.stringify(envelopes);
    for (const secret of Object.values(secrets))
      assert.equal(wire.includes(secret), false);
    assert.equal(wire.includes('http.request.body.data'), false);
    assert.ok(wire.includes('transaction'));
    assert.equal(wire.includes('Fixture infrastructure failure'), failure);
  }
}

console.log('Password telemetry regressions passed');
