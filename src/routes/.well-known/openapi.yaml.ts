import type {RequestHandler} from './$types';

export const GET: RequestHandler = async () => {
  return new Response(null, {
    status: 302,
    headers: {Location: '/api/openapi.yaml'}
  });
};
