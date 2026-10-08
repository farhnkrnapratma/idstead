const errorSchema = {
  type: 'object',
  properties: {
    error: {
      type: 'object',
      properties: {
        code: {type: 'string', example: 'BLOG_POST_NOT_FOUND'},
        message: {type: 'string', example: 'Blog post not found'},
        details: {
          type: 'string',
          example: "No blog post exists with slug 'this-slug-does-not-exist'."
        }
      },
      required: ['code', 'message']
    }
  },
  required: ['error']
};

const paginationSchema = {
  type: 'object',
  properties: {
    page: {type: 'integer', example: 1},
    limit: {type: 'integer', example: 20},
    total: {type: 'integer', example: 42},
    totalPages: {type: 'integer', example: 3},
    hasNextPage: {type: 'boolean'},
    hasPrevPage: {type: 'boolean'}
  }
};

const blogPostSummarySchema = {
  type: 'object',
  properties: {
    id: {type: 'string', format: 'uuid'},
    title: {type: 'string'},
    slug: {type: 'string'},
    excerpt: {type: 'string', nullable: true},
    summary: {type: 'string', nullable: true},
    tldr: {type: 'array', items: {type: 'string'}, nullable: true},
    collaborators: {type: 'array', items: {type: 'string'}},
    created_at: {type: 'string', format: 'date-time'},
    updated_at: {type: 'string', format: 'date-time'}
  }
};

const blogPostDetailSchema = {
  allOf: [
    blogPostSummarySchema,
    {
      type: 'object',
      properties: {
        published: {type: 'boolean'},
        comment_count: {type: 'integer'},
        views_count: {type: 'integer'},
        content: {type: 'string', description: 'Raw markdown body of the post.'}
      }
    }
  ]
};

const commentSchema = {
  type: 'object',
  properties: {
    id: {type: 'string', format: 'uuid'},
    post_id: {type: 'string', format: 'uuid'},
    parent_id: {type: 'string', format: 'uuid', nullable: true},
    author_name: {type: 'string'},
    content: {type: 'string'},
    is_anonymous: {type: 'boolean'},
    is_admin: {type: 'boolean'},
    is_approved: {
      type: 'boolean',
      description:
        'False when the comment was held for moderation instead of published immediately.'
    },
    created_at: {type: 'string', format: 'date-time'}
  }
};

const searchResultSchema = {
  type: 'object',
  properties: {
    type: {type: 'string', enum: ['post', 'project']},
    title: {type: 'string'},
    subtitle: {type: 'string'},
    url: {type: 'string'}
  }
};

const authorSubResourceSchema = {
  type: 'object',
  description:
    'Shape varies by field and is sanitized of internal/legacy keys (id, sortOrder, etc). See GET /api/v1/author for a combined example.',
  additionalProperties: true
};

const authorProfileSchema = {
  ...authorSubResourceSchema,
  description:
    'Public author profile, including the public contact email address.',
  properties: {
    email: {type: 'string', format: 'email'},
    pronunciation: {
      type: 'string',
      description:
        'Pronunciation of the author name, preserved as entered, including any slashes or brackets; empty when unset.'
    }
  }
};

const pageParam = {
  name: 'page',
  in: 'query',
  schema: {type: 'integer', default: 1, minimum: 1},
  description: '1-based page number.'
};
const limitParam = (def: number, max: number) => ({
  name: 'limit',
  in: 'query',
  schema: {type: 'integer', default: def, minimum: 1, maximum: max},
  description: `Results per page (max ${max}).`
});
const formatParam = {
  name: 'format',
  in: 'query',
  schema: {type: 'string', enum: ['json', 'md', 'markdown']},
  description:
    'Overrides the Accept header. "md"/"markdown" returns text/markdown instead of JSON.'
};
const errorResponses = {
  '400': {
    description: 'Bad Request',
    content: {'application/json': {schema: errorSchema}}
  },
  '401': {
    description: 'Unauthorized',
    content: {'application/json': {schema: errorSchema}}
  },
  '403': {
    description: 'Forbidden',
    content: {'application/json': {schema: errorSchema}}
  },
  '404': {
    description: 'Not Found',
    content: {'application/json': {schema: errorSchema}}
  },
  '429': {
    description: 'Too Many Requests',
    content: {'application/json': {schema: errorSchema}}
  },
  '500': {
    description: 'Internal Server Error',
    content: {'application/json': {schema: errorSchema}}
  }
};

export const openapiSpec = {
  openapi: '3.0.3',
  info: {
    title: 'Public REST API',
    version: '1.0.0',
    description:
      'Machine-readable OpenAPI spec for the public REST endpoints served under /api/v1/. '
      + 'See GET /api/v1 for the human-readable reference and CORS/versioning notes.'
  },
  servers: [{url: '/'}],
  components: {
    schemas: {
      Error: errorSchema,
      Pagination: paginationSchema,
      BlogPostSummary: blogPostSummarySchema,
      BlogPostDetail: blogPostDetailSchema,
      Comment: commentSchema,
      SearchResult: searchResultSchema,
      AuthorSubResource: authorSubResourceSchema,
      AuthorProfile: authorProfileSchema
    }
  },
  paths: {
    '/api/v1': {
      get: {
        summary: 'Redirects to the API reference',
        description: 'Permanently redirects to GET /api/v1/docs.',
        responses: {'301': {description: 'Moved Permanently to /api/v1/docs'}}
      }
    },
    '/api/v1/docs': {
      get: {
        summary: 'API reference (human-readable)',
        description:
          'Returns the same content as src/routes/api/v1/README.md as text/markdown - a good starting point for agents.',
        responses: {
          '200': {
            description: 'OK',
            content: {'text/markdown': {schema: {type: 'string'}}}
          }
        }
      }
    },
    '/api/v1/blog': {
      get: {
        summary: 'List blog posts',
        description:
          'Paginated list of published posts. Supports full-text-ish filtering via `q` and ?format=md for an LLM-friendly markdown catalog.',
        parameters: [
          {
            name: 'q',
            in: 'query',
            schema: {type: 'string'},
            description: 'Filters by title/excerpt (ILIKE match).'
          },
          {
            name: 'id',
            in: 'query',
            schema: {type: 'string', format: 'uuid'},
            description: 'Return only the post with this id.'
          },
          {
            name: 'slug',
            in: 'query',
            schema: {type: 'string'},
            description: 'Return only the post with this slug.'
          },
          pageParam,
          limitParam(20, 100),
          formatParam
        ],
        responses: {
          '200': {
            description: 'OK',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    data: {type: 'array', items: blogPostSummarySchema},
                    total: {type: 'integer'},
                    pagination: paginationSchema
                  }
                }
              },
              'text/markdown': {schema: {type: 'string'}}
            }
          },
          '400': errorResponses['400'],
          '500': errorResponses['500']
        }
      }
    },
    '/api/v1/blog/{id_or_slug}': {
      get: {
        summary: 'Get a single blog post',
        parameters: [
          {
            name: 'id_or_slug',
            in: 'path',
            required: true,
            schema: {type: 'string'},
            description: 'A post UUID or its slug.'
          },
          {
            name: 'format',
            in: 'query',
            schema: {
              type: 'string',
              enum: ['json', 'md', 'markdown', 'text', 'txt']
            },
            description:
              'Overrides the Accept header. "md"/"markdown" returns text/markdown; "text"/"txt" returns text/plain.'
          }
        ],
        responses: {
          '200': {
            description: 'OK',
            content: {
              'application/json': {schema: blogPostDetailSchema},
              'text/markdown': {schema: {type: 'string'}},
              'text/plain': {schema: {type: 'string'}}
            }
          },
          '400': errorResponses['400'],
          '404': errorResponses['404']
        }
      }
    },
    '/api/v1/author': {
      get: {
        summary: 'Author profile (combined)',
        description:
          'Returns profile, cv, funding, contact, skills and socials in one payload unless narrowed with `fields`.',
        parameters: [
          {
            name: 'fields',
            in: 'query',
            schema: {type: 'string'},
            description:
              'Comma-separated subset of: profile,cv,funding,contact,skills,socials. Omit for all fields.'
          },
          formatParam
        ],
        responses: {
          '200': {
            description: 'OK',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    profile: authorProfileSchema,
                    cv: authorSubResourceSchema,
                    funding: authorSubResourceSchema,
                    contact: authorSubResourceSchema,
                    skills: authorSubResourceSchema,
                    socials: authorSubResourceSchema
                  }
                }
              },
              'text/markdown': {schema: {type: 'string'}}
            }
          }
        }
      }
    },
    '/api/v1/author/contact': {
      get: {
        summary: 'Author contact info only',
        responses: {
          '200': {
            description: 'OK',
            content: {'application/json': {schema: authorSubResourceSchema}}
          }
        }
      }
    },
    '/api/v1/author/socials': {
      get: {
        summary: 'Author social profile links only',
        responses: {
          '200': {
            description: 'OK',
            content: {'application/json': {schema: authorSubResourceSchema}}
          }
        }
      }
    },
    '/api/v1/author/skills': {
      get: {
        summary: 'Author skills, grouped by category',
        responses: {
          '200': {
            description: 'OK',
            content: {'application/json': {schema: authorSubResourceSchema}}
          }
        }
      }
    },
    '/api/v1/author/funding': {
      get: {
        summary: 'Author funding/sponsorship links only',
        responses: {
          '200': {
            description: 'OK',
            content: {'application/json': {schema: authorSubResourceSchema}}
          }
        }
      }
    },
    '/api/v1/author/cv': {
      get: {
        summary:
          'Author CV entries only (experience + education, structured JSON)',
        description:
          'Structured CV data. For the actual PDF file, use GET /api/v1/cv instead.',
        responses: {
          '200': {
            description: 'OK',
            content: {'application/json': {schema: authorSubResourceSchema}}
          }
        }
      }
    },
    '/api/v1/cv': {
      get: {
        summary: 'Download active CV PDF or SHA256 verification checksum',
        parameters: [
          {
            name: 'download',
            in: 'query',
            required: false,
            schema: {type: 'string', enum: ['1', 'true']},
            description:
              'Force Content-Disposition attachment header for direct file download using exact R2 filename.'
          },
          {
            name: 'format',
            in: 'query',
            required: false,
            schema: {type: 'string', enum: ['sha256']},
            description:
              'Download the SHA256 checksum verification sidecar text file.'
          },
          {
            name: 'checksum',
            in: 'query',
            required: false,
            schema: {type: 'string', enum: ['1', 'true']},
            description: 'Alias for format=sha256.'
          }
        ],
        responses: {
          '200': {
            description: 'OK',
            headers: {
              'X-Checksum-SHA256': {
                schema: {type: 'string'},
                description:
                  'Full 64-character SHA-256 cryptographic fingerprint hash of the CV PDF file.'
              }
            },
            content: {
              'application/pdf': {schema: {type: 'string', format: 'binary'}},
              'text/plain': {schema: {type: 'string'}}
            }
          },
          '404': {description: 'No active CV document is configured.'},
          '502': {
            description: 'Failed to fetch the CV file from storage.',
            content: {'application/json': {schema: errorSchema}}
          }
        }
      }
    },
    '/api/v1/search': {
      get: {
        summary: 'Search blog posts',
        parameters: [
          {
            name: 'q',
            in: 'query',
            required: true,
            schema: {type: 'string', minLength: 2},
            description:
              'Query string (minimum 2 characters; shorter values return an empty result set, not an error).'
          },
          limitParam(6, 20),
          {
            name: 'offset',
            in: 'query',
            schema: {type: 'integer', minimum: 0, default: 0},
            description:
              'Number of matching posts to skip. Combine with `limit` to page through results; `pagination.hasMore` reports whether another page exists.'
          }
        ],
        responses: {
          '200': {
            description: 'OK',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    query: {type: 'string'},
                    data: {type: 'array', items: searchResultSchema},
                    pagination: {
                      type: 'object',
                      properties: {
                        limit: {type: 'integer'},
                        offset: {type: 'integer'},
                        returned: {type: 'integer'},
                        hasMore: {type: 'boolean'}
                      }
                    }
                  }
                }
              }
            }
          },
          '400': errorResponses['400']
        }
      }
    },
    '/api/v1/blog/comments': {
      get: {
        summary: 'List approved comments',
        description:
          'Comments are moderated automatically at submission time; only approved comments are ever returned here.',
        parameters: [
          {
            name: 'postId',
            in: 'query',
            schema: {type: 'string', format: 'uuid'},
            description:
              'Filter to one post. Omit to get recent approved comments site-wide.'
          },
          limitParam(50, 100)
        ],
        responses: {
          '200': {
            description: 'OK',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {data: {type: 'array', items: commentSchema}}
                }
              }
            }
          },
          '400': errorResponses['400']
        }
      }
    },
    '/api/v1/blog/views': {
      get: {
        summary: 'Get view count for a post',
        parameters: [
          {
            name: 'postId',
            in: 'query',
            required: true,
            schema: {type: 'string', format: 'uuid'}
          }
        ],
        responses: {
          '200': {
            description: 'OK',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    postId: {type: 'string'},
                    views: {type: 'integer'}
                  }
                }
              }
            }
          },
          '400': errorResponses['400']
        }
      }
    }
  }
};

const fetchFailures: Record<string, string> = {
  '/api/v1/search': 'SEARCH_FETCH_FAILED',
  '/api/v1/blog/{id_or_slug}':
    'BLOG_POST_FETCH_FAILED or BLOG_POST_COUNTS_FETCH_FAILED',
  '/api/v1/blog/views': 'BLOG_VIEWS_FETCH_FAILED',
  '/api/v1/author': 'AUTHOR_FETCH_FAILED',
  '/api/v1/author/contact': 'AUTHOR_CONTACT_FETCH_FAILED',
  '/api/v1/author/cv': 'AUTHOR_CV_FETCH_FAILED',
  '/api/v1/author/skills': 'AUTHOR_SKILLS_FETCH_FAILED',
  '/api/v1/author/funding': 'AUTHOR_FUNDING_FETCH_FAILED',
  '/api/v1/author/socials': 'AUTHOR_SOCIALS_FETCH_FAILED',
  '/api/v1/cv': 'CV_METADATA_FETCH_FAILED'
};
for (const [path, methods] of Object.entries(openapiSpec.paths)) {
  if (!('get' in methods)) continue;
  const responses = methods.get.responses as Record<string, unknown>;
  if (fetchFailures[path])
    responses['500'] = {
      description: fetchFailures[path] + ': the data source could not be read.',
      content: {'application/json': {schema: errorSchema}}
    };
  if (path === '/api/v1/blog/{id_or_slug}')
    responses['502'] = {
      description:
        'BLOG_CONTENT_FETCH_FAILED: post content could not be fetched.',
      content: {'application/json': {schema: errorSchema}}
    };
  responses['304'] = {
    description: 'The requested representation is unchanged. No response body.'
  };
}
