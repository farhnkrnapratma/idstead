import { dataStores } from '../data';
import { publicRepositories } from '../repositories';
import { ipSalt } from '../ipSalt';
import { checkLoginLockout, recordFailedLogin } from '../loginRateLimit';
import { clientIp } from '../rateLimit';
import { oidcSigningKey } from './keys';
import { oidcEndpoints } from './config';
import type { OidcEndpointDeps } from './endpoints';

export async function oidcEndpointDeps(
    platform: unknown,
    request: Request,
    getClientAddress: () => string
): Promise<OidcEndpointDeps | null> {
    const key = await oidcSigningKey(platform);
    const { service } = dataStores(platform);
    if (!key || !service) return null;
    const salt = ipSalt(platform);
    return {
        clients: service.oidcClients,
        auth: service.oidcAuth,
        key,
        issuer: oidcEndpoints(platform).issuer,
        ip: clientIp(request, getClientAddress),
        profile: async () => {
            const profile = await publicRepositories().author.profile({ includeEmail: true });
            return profile ?
                    {
                        name: profile.name,
                        username: profile.username,
                        email: profile.email,
                        siteUrl: profile.siteUrl,
                        avatarVersion: profile.avatarVersion,
                        updatedAt: profile.updatedAt
                    }
                :   null;
        },
        lockout: {
            retryAfter: async keys =>
                (await checkLoginLockout(service.lockout, salt, ...keys)).retryAfterSeconds,
            fail: keys => recordFailedLogin(service.lockout, salt, ...keys)
        }
    };
}
