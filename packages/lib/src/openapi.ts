const errorSchema = {
    type: 'object',
    properties: {
        error: {
            type: 'object',
            properties: {
                code: { type: 'string', example: 'BLOG_POST_NOT_FOUND' },
                message: { type: 'string', example: 'Blog post not found.' },
                details: {
                    type: 'string',
                    example: "No published post matches 'this-slug-does-not-exist'."
                }
            },
            required: ['code', 'message']
        }
    },
    required: ['error']
};

const postIdSchema = {
    type: 'string',
    pattern: '^[0-9a-f]{64}$',
    description: 'Stable public post ID: 64 lowercase hex characters.'
};

const paginationSchema = {
    type: 'object',
    properties: {
        page: { type: 'integer', example: 1 },
        limit: { type: 'integer', example: 20 },
        total: { type: 'integer', example: 42 },
        totalPages: { type: 'integer', example: 3 },
        hasNextPage: { type: 'boolean' },
        hasPrevPage: { type: 'boolean' }
    }
};

const blogPostSchema = {
    type: 'object',
    properties: {
        id: postIdSchema,
        slug: { type: 'string', example: 'update-gnome-51' },
        title: { type: 'string' },
        excerpt: { type: 'string', nullable: true },
        summary: { type: 'string', nullable: true },
        tldr: { type: 'array', items: { type: 'string' } },
        tags: { type: 'array', items: { type: 'string' } },
        collaborators: { type: 'array', items: { type: 'string' } },
        created_at: { type: 'string', format: 'date-time' },
        updated_at: { type: 'string', format: 'date-time' }
    }
};

const blogPostDetailSchema = {
    allOf: [
        blogPostSchema,
        {
            type: 'object',
            properties: { comment_count: { type: 'integer' }, views_count: { type: 'integer' } }
        }
    ]
};

const commentSchema: Record<string, unknown> = {
    type: 'object',
    properties: {
        author_name: { type: 'string', nullable: true },
        content: { type: 'string' },
        is_admin: { type: 'boolean' },
        is_anonymous: { type: 'boolean' },
        created_at: { type: 'string', format: 'date-time' },
        replies: { type: 'array', items: { $ref: '#/components/schemas/Comment' } }
    }
};

const recentCommentSchema = {
    type: 'object',
    properties: {
        post: { type: 'object', properties: { id: postIdSchema, slug: { type: 'string' } } },
        author_name: { type: 'string', nullable: true },
        content: { type: 'string' },
        is_admin: { type: 'boolean' },
        is_anonymous: { type: 'boolean' },
        is_reply: { type: 'boolean' },
        created_at: { type: 'string', format: 'date-time' }
    }
};

const searchResultSchema = {
    type: 'object',
    properties: {
        type: { type: 'string', enum: ['post'] },
        id: postIdSchema,
        title: { type: 'string' },
        subtitle: { type: 'string' },
        url: { type: 'string' }
    }
};

const authorSchema = {
    type: 'object',
    description:
        'One key per requested field (profile, contact, cv, funding, skills, socials). Internal keys such as IDs and sort orders are removed.',
    additionalProperties: true
};

const param = (
    name: string,
    alias: string | null,
    schema: Record<string, unknown>,
    description: string,
    required = false
) => ({
    name,
    in: 'query',
    required,
    schema,
    description: alias ? `${description} Alias: \`${alias}\`.` : description
});

const idParam = (required: boolean) =>
    param(
        'id',
        null,
        { type: 'string' },
        'Post ID (64 hex characters), a unique ID prefix of at least 7 characters, or the post slug.',
        required
    );
const outputParam = (values: string[], fallback: string) =>
    param(
        'output',
        'o',
        { type: 'string', enum: values, default: fallback },
        'Response representation. Overrides the Accept header.'
    );
const pageParam = param('page', 'p', { type: 'integer', minimum: 1, default: 1 }, '1-based page.');
const limitParam = (fallback: number, max: number) =>
    param(
        'limit',
        'n',
        { type: 'integer', minimum: 1, maximum: max, default: fallback },
        `Results per page (max ${max}).`
    );
const queryParam = param('query', 'q', { type: 'string' }, 'Matches post titles and excerpts.');

const errorResponse = (description: string) => ({
    description,
    content: { 'application/json': { schema: errorSchema } }
});
const commonErrors = {
    '400': errorResponse(
        'UNKNOWN_PARAMETER, PARAM_CONFLICT, PARAM_INVALID or OUTPUT_UNSUPPORTED: the query string is invalid.'
    ),
    '429': errorResponse('RATE_LIMITED: over 60 requests per minute.')
};
const postLookupErrors = {
    ...commonErrors,
    '400': errorResponse(
        'BLOG_POST_ID_REQUIRED or BLOG_POST_ID_INVALID, or a generic parameter error.'
    ),
    '404': errorResponse('BLOG_POST_NOT_FOUND: no published post matches the reference.'),
    '409': errorResponse('BLOG_POST_ID_AMBIGUOUS: the ID prefix matches several posts.')
};
const jsonContent = (schema: unknown) => ({ 'application/json': { schema } });
const textContent = (type: 'text/markdown' | 'text/plain') => ({
    [type]: { schema: { type: 'string' } }
});

export const openapiSpec = {
    openapi: '3.0.3',
    info: {
        title: 'Public REST API',
        version: '1.0.0',
        description:
            'Read-only public API served under /api/v1/. GET /api/v1 returns the human-readable reference. '
            + 'Every parameter has a one-letter alias; unknown parameters are rejected.'
    },
    servers: [{ url: '/' }],
    components: {
        schemas: {
            Error: errorSchema,
            Pagination: paginationSchema,
            BlogPost: blogPostSchema,
            BlogPostDetail: blogPostDetailSchema,
            Comment: commentSchema,
            RecentComment: recentCommentSchema,
            SearchResult: searchResultSchema,
            Author: authorSchema
        }
    },
    paths: {
        '/api/v1': {
            get: {
                summary: 'API reference',
                description:
                    'Returns this API reference as text/markdown. Send Accept: application/json or output=json for a JSON index of endpoints.',
                parameters: [outputParam(['md', 'json'], 'md')],
                responses: {
                    '200': {
                        description: 'OK',
                        content: {
                            ...textContent('text/markdown'),
                            ...jsonContent({ type: 'object' })
                        }
                    },
                    ...commonErrors
                }
            }
        },
        '/api/v1/blog': {
            get: {
                summary: 'List blog posts or read one post',
                description:
                    'Without `id`, lists published posts newest first. With `id`, returns one post with view and comment counts; `id` cannot be combined with query, page or limit.',
                parameters: [
                    idParam(false),
                    queryParam,
                    pageParam,
                    limitParam(20, 100),
                    outputParam(['json', 'md', 'txt'], 'json')
                ],
                responses: {
                    '200': {
                        description:
                            'A post list (`data` + `pagination`), or one BlogPostDetail when `id` is given. `txt` is only available with `id`.',
                        content: {
                            ...jsonContent({
                                oneOf: [
                                    {
                                        type: 'object',
                                        properties: {
                                            data: { type: 'array', items: blogPostSchema },
                                            pagination: paginationSchema
                                        }
                                    },
                                    blogPostDetailSchema
                                ]
                            }),
                            ...textContent('text/markdown'),
                            ...textContent('text/plain')
                        }
                    },
                    ...postLookupErrors,
                    '500': errorResponse(
                        'BLOG_LIST_FETCH_FAILED, BLOG_POST_FETCH_FAILED or BLOG_POST_COUNTS_FETCH_FAILED.'
                    )
                }
            }
        },
        '/api/v1/blog/content': {
            get: {
                summary: 'Read the body of a blog post',
                description: 'Returns the post body. Markdown by default.',
                parameters: [idParam(true), outputParam(['md', 'txt', 'json'], 'md')],
                responses: {
                    '200': {
                        description: 'OK',
                        content: {
                            ...textContent('text/markdown'),
                            ...textContent('text/plain'),
                            ...jsonContent({
                                type: 'object',
                                properties: {
                                    id: postIdSchema,
                                    slug: { type: 'string' },
                                    title: { type: 'string' },
                                    content: { type: 'string' }
                                }
                            })
                        }
                    },
                    ...postLookupErrors,
                    '500': errorResponse('BLOG_POST_FETCH_FAILED.'),
                    '502': errorResponse('BLOG_CONTENT_FETCH_FAILED: the body could not be read.')
                }
            }
        },
        '/api/v1/blog/comments': {
            get: {
                summary: 'Read approved comments',
                description:
                    'With `id`, returns the threads of one post oldest first, replies nested under `replies`. Without `id`, returns the newest comments across the site.',
                parameters: [idParam(false), limitParam(50, 100)],
                responses: {
                    '200': {
                        description: 'OK',
                        content: jsonContent({
                            oneOf: [
                                {
                                    type: 'object',
                                    properties: {
                                        id: postIdSchema,
                                        slug: { type: 'string' },
                                        data: {
                                            type: 'array',
                                            items: { $ref: '#/components/schemas/Comment' }
                                        },
                                        hasMore: { type: 'boolean' }
                                    }
                                },
                                {
                                    type: 'object',
                                    properties: {
                                        data: { type: 'array', items: recentCommentSchema }
                                    }
                                }
                            ]
                        })
                    },
                    ...postLookupErrors,
                    '500': errorResponse('BLOG_COMMENTS_FETCH_FAILED.')
                }
            }
        },
        '/api/v1/blog/views': {
            get: {
                summary: 'Read the view count of a post',
                parameters: [idParam(true)],
                responses: {
                    '200': {
                        description: 'OK',
                        content: jsonContent({
                            type: 'object',
                            properties: {
                                id: postIdSchema,
                                slug: { type: 'string' },
                                views: { type: 'integer' }
                            }
                        })
                    },
                    ...postLookupErrors,
                    '500': errorResponse('BLOG_VIEWS_FETCH_FAILED.')
                }
            }
        },
        '/api/v1/author': {
            get: {
                summary: 'Read the author profile',
                description:
                    '`field` selects sections (comma-separated or repeated); all sections by default. `output=pdf` is only available when `field` is exactly `cv`.',
                parameters: [
                    param(
                        'field',
                        'f',
                        {
                            type: 'array',
                            items: {
                                type: 'string',
                                enum: ['profile', 'contact', 'cv', 'funding', 'skills', 'socials']
                            }
                        },
                        'Sections to include.'
                    ),
                    outputParam(['json', 'md', 'pdf'], 'json'),
                    param(
                        'checksum',
                        'c',
                        { type: 'boolean', default: true },
                        'Only with output=pdf. Adds Repr-Digest and X-Checksum-SHA256 headers.'
                    )
                ],
                responses: {
                    '200': {
                        description: 'OK',
                        content: {
                            ...jsonContent(authorSchema),
                            ...textContent('text/markdown'),
                            'application/pdf': { schema: { type: 'string', format: 'binary' } }
                        }
                    },
                    ...commonErrors,
                    '400': errorResponse(
                        'AUTHOR_FIELD_INVALID, CV_CHECKSUM_REQUIRES_PDF, OUTPUT_UNSUPPORTED or a generic parameter error.'
                    ),
                    '404': errorResponse('CV_DOCUMENT_NOT_FOUND: no active CV PDF.'),
                    '500': errorResponse('AUTHOR_FETCH_FAILED or CV_METADATA_FETCH_FAILED.'),
                    '502': errorResponse('CV_FETCH_FAILED: the CV PDF could not be read.')
                }
            }
        },
        '/api/v1/cv': {
            get: {
                summary: 'Read the CV',
                description:
                    'Identical to GET /api/v1/author?field=cv. `output=pdf` downloads the PDF; its SHA-256 is sent in Repr-Digest and X-Checksum-SHA256 unless checksum=false.',
                parameters: [
                    outputParam(['json', 'md', 'pdf'], 'json'),
                    param(
                        'checksum',
                        'c',
                        { type: 'boolean', default: true },
                        'Only with output=pdf.'
                    )
                ],
                responses: {
                    '200': {
                        description: 'OK',
                        content: {
                            ...jsonContent(authorSchema),
                            ...textContent('text/markdown'),
                            'application/pdf': { schema: { type: 'string', format: 'binary' } }
                        }
                    },
                    ...commonErrors,
                    '400': errorResponse(
                        'CV_CHECKSUM_REQUIRES_PDF, OUTPUT_UNSUPPORTED or a generic parameter error.'
                    ),
                    '404': errorResponse('CV_DOCUMENT_NOT_FOUND: no active CV PDF.'),
                    '500': errorResponse('AUTHOR_FETCH_FAILED or CV_METADATA_FETCH_FAILED.'),
                    '502': errorResponse('CV_FETCH_FAILED: the CV PDF could not be read.')
                }
            }
        },
        '/api/v1/search': {
            get: {
                summary: 'Search blog posts',
                description:
                    'Matches titles and excerpts. Queries shorter than two characters return an empty result.',
                parameters: [queryParam, pageParam, limitParam(6, 20)],
                responses: {
                    '200': {
                        description: 'OK',
                        content: jsonContent({
                            type: 'object',
                            properties: {
                                query: { type: 'string' },
                                data: { type: 'array', items: searchResultSchema },
                                pagination: {
                                    type: 'object',
                                    properties: {
                                        page: { type: 'integer' },
                                        limit: { type: 'integer' },
                                        returned: { type: 'integer' },
                                        hasMore: { type: 'boolean' }
                                    }
                                }
                            }
                        })
                    },
                    ...commonErrors,
                    '500': errorResponse('SEARCH_FETCH_FAILED.')
                }
            }
        }
    }
};

for (const methods of Object.values(openapiSpec.paths)) {
    (methods.get.responses as Record<string, unknown>)['304'] = {
        description: 'The requested representation is unchanged. No response body.'
    };
}
