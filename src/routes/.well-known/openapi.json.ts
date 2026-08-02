import type {RequestHandler} from './$types';

const openapi = {
  openapi: '3.0.3',
  info: {
    title: 'fkp.my.id Public API',
    version: '1.0.0',
    description: 'Machine-readable OpenAPI spec for the public REST endpoints.'
  },
  servers: [{url: 'https://fkp.my.id'}],
  components: {
    securitySchemes: {bearerAuth: {type: 'http', scheme: 'bearer', bearerFormat: 'JWT'}},
    schemas: {
      Error: {type: 'object', properties: {code: {type: 'integer'}, error: {type: 'string'}}}
    }
  },
  paths: {
    '/api/blog': {get: {summary: 'List blog posts', responses: {'200': {description: 'OK'}}}},
    '/api/blog/{id_or_slug}': {get: {summary: 'Get blog post', parameters: [{name: 'id_or_slug', in: 'path', required: true, schema: {type: 'string'}}], responses: {'200': {description: 'OK'}, '404': {description: 'Not found', content: {'application/json': {schema: {'$ref': '#/components/schemas/Error'}}}}}}},
    '/api/comments': {get: {summary: 'List approved comments'}, post: {summary: 'Submit comment'}},
    '/api/views': {get: {summary: 'Get view count'}, post: {summary: 'Record view'}},
    '/api/search': {get: {summary: 'Search posts'}},
    '/api/author': {get: {summary: 'Author profile'}},
    '/api/cv': {get: {summary: 'Download CV PDF'}},
    '/api/admin/cv/upload': {post: {summary: 'Admin: upload CV', security: [{bearerAuth: []}]}},
    '/api/admin/cv/delete': {post: {summary: 'Admin: delete CV', security: [{bearerAuth: []}]}}
  }
}

export const GET: RequestHandler = async () => {
  return new Response(JSON.stringify(openapi, null, 2), {
    headers: {'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'public, max-age=86400'}
  })
}
