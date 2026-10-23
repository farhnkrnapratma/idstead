import { page } from '$app/state';
import { isHiddenLegalPath } from './legalVisibility';

const MAILING_COMMAND = '/mailing';

export function isHiddenCommand(path: string | undefined): boolean {
    if (!path?.startsWith('/')) return false;
    if (path === MAILING_COMMAND || path.startsWith(`${MAILING_COMMAND} `))
        return !page.data.newsletterEnabled;
    return isHiddenLegalPath(path);
}
