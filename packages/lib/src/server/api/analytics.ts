import { analyticsFacts, type AnalyticsFacts } from '@idstead/domain/analytics.ts';
import type { Repositories } from '@idstead/data';
import type { ApiContext } from './blog';
import { ApiRequestError, parseApiParams } from './params';
import { jsonResponse } from './responses';

export async function analyticsData(repos: Pick<Repositories, 'site'>): Promise<AnalyticsFacts> {
    return analyticsFacts(await repos.site.analytics());
}

export async function getAnalytics(ctx: ApiContext) {
    parseApiParams(ctx.url, []);
    try {
        return jsonResponse(await analyticsData(ctx.repos));
    } catch {
        throw new ApiRequestError(
            500,
            'ANALYTICS_FETCH_FAILED',
            'Could not read the analytics settings.'
        );
    }
}
