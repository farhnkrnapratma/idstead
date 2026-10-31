# v1 Analytics

Handler: `getAnalytics` in `packages/lib/src/server/api/analytics.ts`.

## `GET /v1/analytics`

The analytics the site loads, as chosen in the admin ([Analytics and consent](../../003-architecture/013-analytics-and-consent.md)). It takes no parameters; any parameter returns `400 UNKNOWN_PARAMETER`. The response is always JSON and never contains IDs, tokens or script URLs.

```json
{ "enabled": true, "provider": "ga4", "name": "Google Analytics 4", "cookies": true }
```

| Field      | Value                                                                      |
| ---------- | -------------------------------------------------------------------------- |
| `enabled`  | `false` only for `none`                                                    |
| `provider` | `none`, `ga4`, `gtm`, `umami`, `plausible` or `cloudflare`                 |
| `name`     | Display name, `None` without analytics                                     |
| `cookies`  | `true` when the provider sets cookies, so the site shows the cookie banner |

```sh
curl "https://api.example.com/v1/analytics"
```

MDRS pages read the same object as `api.v1.analytics` ([Live data](../../008-mdrs/002-extensions/014-live-data.md#apiv1analytics)).

## Errors

`ANALYTICS_FETCH_FAILED` (500), plus the shared errors in [errors.md](002-errors.md).
