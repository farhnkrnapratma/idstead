/** @format */

const errorSchema = {
  type: 'object',
  properties: {
    code: {type: 'integer', example: 404},
    error: {
      type: 'string',
      example:
        '404 Not Found: Requested API endpoint or resource does not exist.'
    }
  },
  required: ['code', 'error']
}

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
}

const blogPostSummarySchema = {
  type: 'object',
  properties: {
    id: {type: 'string', format: 'uuid'},
    title: {type: 'string'},
    slug: {type: 'string'},
    excerpt: {type: 'string', nullable: true},
    created_at: {type: 'string', format: 'date-time'},
    updated_at: {type: 'string', format: 'date-time'},
    banner_path: {type: 'string', nullable: true}
  }
}

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
}

const commentSchema = {
  type: 'object',
  properties: {
    id: {type: 'string', format: 'uuid'},
    post_id: {type: 'string', format: 'uuid'},
    parent_id: {type: 'string', format: 'uuid', nullable: true},
    author_name: {type: 'string'},
    content: {type: 'string'},
    is_anonymous: {type: 'boolean'},
    is_approved: {
      type: 'boolean',
      description:
        'False when the comment was held for moderation instead of published immediately.'
    },
    created_at: {type: 'string', format: 'date-time'}
  }
}

const searchResultSchema = {
  type: 'object',
  properties: {
    type: {type: 'string', enum: ['post', 'project']},
    title: {type: 'string'},
    subtitle: {type: 'string'},
    url: {type: 'string'},
    tags: {type: 'array', items: {type: 'string'}}
  }
}

const authorSubResourceSchema = {
  type: 'object',
  description:
    'Shape varies by field and is sanitized of internal/legacy keys (id, sortOrder, etc). See GET /api/v1/author for a combined example.',
  additionalProperties: true
}

const pageParam = {
  name: 'page',
  in: 'query',
  schema: {type: 'integer', default: 1, minimum: 1},
  description: '1-based page number.'
}
const limitParam = (def: number, max: number) => ({
  name: 'limit',
  in: 'query',
  schema: {type: 'integer', default: def, minimum: 1, maximum: max},
  description: `Results per page (max ${max}).`
})
const formatParam = {
  name: 'format',
  in: 'query',
  schema: {type: 'string', enum: ['json', 'md', 'markdown']},
  description:
    'Overrides the Accept header. "md"/"markdown" returns text/markdown instead of JSON.'
}

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
}

export const openapiSpec = {
  openapi: '3.0.3',
  info: {
    title: 'fkp.my.id Public API',
    version: '1.0.0',
    description:
      'Machine-readable OpenAPI spec for the public REST endpoints served at fkp.my.id under /api/v1/. '
      + 'See GET /api/v1 (or src/routes/api/v1/README.md) for the human-readable reference and CORS/versioning notes.'
  },
  servers: [{url: 'https://fkp.my.id'}],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description:
          'Supabase Auth session token for the site admin. Required only for /api/v1/admin/* routes.'
      }
    },
    schemas: {
      Error: errorSchema,
      Pagination: paginationSchema,
      BlogPostSummary: blogPostSummarySchema,
      BlogPostDetail: blogPostDetailSchema,
      Comment: commentSchema,
      SearchResult: searchResultSchema,
      AuthorSubResource: authorSubResourceSchema
    }
  },
  paths: {
    '/api/v1': {
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
          formatParam
        ],
        responses: {
          '200': {
            description: 'OK',
            content: {
              'application/json': {schema: blogPostDetailSchema},
              'text/markdown': {schema: {type: 'string'}}
            }
          },
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
                    profile: authorSubResourceSchema,
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
        summary: 'Download the active CV as a PDF',
        responses: {
          '200': {
            description: 'OK',
            content: {
              'application/pdf': {schema: {type: 'string', format: 'binary'}}
            }
          },
          '302': {
            description:
              'Redirects to the CDN URL if the file could not be proxied.'
          },
          '404': {description: 'No active CV document is configured.'}
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
          limitParam(6, 20)
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
                        returned: {type: 'integer'}
                      }
                    }
                  }
                }
              }
            }
          }
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
      },
      post: {
        summary: 'Submit a comment',
        description:
          'Public, no authentication required beyond a valid Cloudflare Turnstile token. Every submission is moderated with Cloudflare Workers AI '
          + '(@cf/meta/llama-guard-3-8b), falling back to a rules-based heuristic if the AI binding is unavailable. '
          + 'is_approved in the response indicates whether it is now publicly visible or held back.',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['postId', 'content', 'turnstileToken'],
                properties: {
                  postId: {type: 'string', format: 'uuid'},
                  parentId: {
                    type: 'string',
                    format: 'uuid',
                    nullable: true,
                    description: 'Set to reply to an existing comment.'
                  },
                  authorName: {
                    type: 'string',
                    description: 'Required unless isAnonymous is true.'
                  },
                  isAnonymous: {type: 'boolean', default: false},
                  content: {type: 'string', maxLength: 2000},
                  turnstileToken: {
                    type: 'string',
                    description:
                      'Cloudflare Turnstile response token from the widget rendered on the comment form. Verified server-side via siteverify before the comment is accepted.'
                  }
                }
              },
              example: {
                postId: '37f40194-33b8-47b1-9243-7a5c72877559',
                authorName: 'Jane Doe',
                isAnonymous: false,
                content: 'Great post!',
                turnstileToken: '0.AAAA...'
              }
            }
          }
        },
        responses: {
          '201': {
            description: 'Created',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    is_approved: {type: 'boolean'},
                    comment: commentSchema,
                    moderation: {
                      type: 'object',
                      properties: {
                        engine: {
                          type: 'string',
                          enum: ['llama-guard-3', 'heuristic']
                        },
                        categories: {
                          type: 'array',
                          items: {type: 'string'},
                          description:
                            'Llama Guard S1-S11 violation codes when unsafe, empty when safe.'
                        }
                      }
                    }
                  }
                }
              }
            }
          },
          '400': errorResponses['400'],
          '403': errorResponses['403']
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
      },
      post: {
        summary: 'Record a view (rate-limited, deduplicated per IP per day)',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['postId'],
                properties: {postId: {type: 'string', format: 'uuid'}}
              }
            }
          }
        },
        responses: {
          '201': {
            description: 'View recorded',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {counted: {type: 'boolean', example: true}}
                }
              }
            }
          },
          '200': {
            description: 'Already counted for this IP today',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {counted: {type: 'boolean', example: false}}
                }
              }
            }
          },
          '400': errorResponses['400']
        }
      }
    },
    '/api/v1/admin/login': {
      post: {
        summary: 'Admin: sign in',
        description:
          'Exchanges site-owner credentials plus a Cloudflare Turnstile token for a Supabase Auth session. Gated on Turnstile so this unauthenticated endpoint is not open to scripted brute-force. Returns the same session shape as the Supabase JS client, for the frontend to hydrate with supabase.auth.setSession().',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['email', 'password', 'turnstileToken'],
                properties: {
                  email: {type: 'string', format: 'email'},
                  password: {type: 'string', format: 'password'},
                  turnstileToken: {
                    type: 'string',
                    description:
                      'Cloudflare Turnstile response token from the widget rendered on the login form.'
                  }
                }
              }
            }
          }
        },
        responses: {
          '200': {
            description: 'OK',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    session: {
                      type: 'object',
                      description: 'Supabase Auth session object.'
                    }
                  }
                }
              }
            }
          },
          '400': errorResponses['400'],
          '401': errorResponses['401'],
          '403': errorResponses['403']
        }
      }
    },
    '/api/v1/admin/cv/upload': {
      post: {
        summary: 'Admin: upload a new CV PDF',
        description:
          'Proxied to a Supabase Edge Function, which stores the file in Cloudflare R2 and updates the CV record.',
        security: [{bearerAuth: []}],
        requestBody: {
          required: true,
          content: {
            'multipart/form-data': {
              schema: {
                type: 'object',
                required: ['file'],
                properties: {
                  file: {
                    type: 'string',
                    format: 'binary',
                    description: 'PDF, max 10MB.'
                  }
                }
              }
            }
          }
        },
        responses: {
          '201': {
            description: 'Created',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: {type: 'boolean'},
                    filename: {type: 'string'},
                    fileUrl: {type: 'string'},
                    hash: {type: 'string'}
                  }
                }
              }
            }
          },
          '400': errorResponses['400'],
          '401': errorResponses['401'],
          '500': errorResponses['500']
        }
      }
    },
    '/api/v1/admin/cv/delete': {
      post: {
        summary: 'Admin: delete the current CV PDF',
        description:
          'Proxied to a Supabase Edge Function, which removes the file from R2 and its CV record.',
        security: [{bearerAuth: []}],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['filename'],
                properties: {filename: {type: 'string'}}
              }
            }
          }
        },
        responses: {
          '200': {
            description: 'OK',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: {type: 'boolean'},
                    filename: {type: 'string'}
                  }
                }
              }
            }
          },
          '400': errorResponses['400'],
          '401': errorResponses['401'],
          '500': errorResponses['500']
        }
      }
    }
  }
}
