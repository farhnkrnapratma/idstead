import { jsToDefineValue, walkPath, type ApiRegistry, type DefineValue } from '@mdrs/core';

export interface MdrsDataLoaders {
    author(): Promise<unknown>;
    blogList(): Promise<unknown>;
    blogPost(slug: string): Promise<unknown>;
    analytics(): Promise<unknown>;
}

export function createMdrsResolvers(loaders: MdrsDataLoaders): ApiRegistry {
    let author: Promise<DefineValue> | null = null;
    let blogList: Promise<DefineValue> | null = null;
    let analytics: Promise<DefineValue> | null = null;
    const blogPosts = new Map<string, Promise<DefineValue>>();
    return {
        author: async path => {
            author ??= loaders.author().then(jsToDefineValue);
            return walkPath(await author, path);
        },
        blog: async path => {
            const [first, ...rest] = path;
            if (first && first.kind === 'index' && typeof first.value === 'string') {
                const slug = first.value;
                if (!blogPosts.has(slug))
                    blogPosts.set(slug, loaders.blogPost(slug).then(jsToDefineValue));
                return walkPath(await blogPosts.get(slug)!, rest);
            }
            blogList ??= loaders.blogList().then(jsToDefineValue);
            return walkPath(await blogList, path);
        },
        analytics: async path => {
            analytics ??= loaders.analytics().then(jsToDefineValue);
            return walkPath(await analytics, path);
        }
    };
}
