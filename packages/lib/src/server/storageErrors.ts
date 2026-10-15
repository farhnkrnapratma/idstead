/**
 * Detects "object not found" responses from R2's S3-compatible API.
 *
 * On Cloudflare Workers the AWS SDK may fail to deserialize the XML error body
 * (e.g. `DOMParser is not defined`), so the error never becomes `NoSuchKey`.
 * The raw HTTP status is still attached to the error, so check that as well.
 */
export function isObjectNotFound(error: unknown): boolean {
    if (!error || typeof error !== 'object') return false;
    const candidate = error as {
        name?: unknown;
        $metadata?: { httpStatusCode?: unknown };
        $response?: { statusCode?: unknown };
    };
    if (candidate.name === 'NoSuchKey' || candidate.name === 'NotFound') return true;
    return (
        candidate.$metadata?.httpStatusCode === 404 || candidate.$response?.statusCode === 404
    );
}
