/** @format */

import type {RequestHandler} from './$types'

const yaml = `openapi: 3.0.3
info:
  title: fkp.my.id Public API
  version: '1.0.0'
  description: Machine-readable OpenAPI spec for the public REST endpoints.
servers:
  - url: https://fkp.my.id
paths:
  /api/blog:
    get:
      summary: List blog posts
  /api/blog/{id_or_slug}:
    get:
      summary: Get blog post
  /api/comments:
    get:
      summary: List approved comments
    post:
      summary: Submit comment
  /api/views:
    get:
      summary: Get view count
    post:
      summary: Record view
  /api/search:
    get:
      summary: Search posts
  /api/author:
    get:
      summary: Author profile
  /api/cv:
    get:
      summary: Download CV PDF
`;

export const GET: RequestHandler = async () => {
  return new Response(yaml, {
    headers: {'Content-Type': 'text/yaml; charset=utf-8', 'Cache-Control': 'public, max-age=86400'}
  })
}
