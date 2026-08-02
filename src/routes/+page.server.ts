/** @format */

import {supabase} from '$lib/supabase'
import type {PageServerLoad} from './$types'
import type {Project} from '$lib/types'
import {
  fetchAuthorProfile,
  fetchCvEntries,
  fetchFundingLinks,
  fetchContactInfo,
  fetchGroupedSkills,
  fetchSocials
} from '$lib/author'

interface GitHubRepo {
  name: string
  description: string | null
  html_url: string
  language: string | null
  stargazers_count: number
  topics: string[]
  fork: boolean
  archived: boolean
  license: {key: string; name: string; spdx_id: string; url: string} | null
}

export interface BlogPost {
  id: string
  title: string
  slug: string
  published: boolean
  storage_path: string
  banner_path?: string | null
  created_at: string
  excerpt?: string | null
  content: string
  read_time?: string
  comment_count?: number
  views_count?: number
  tags?: string[]
}

const GITHUB_USERNAME = 'farhnkrnapratma'
const GITHUB_API_URL = `https://api.github.com/users/${GITHUB_USERNAME}/repos`

export const load: PageServerLoad = async ({fetch, platform, locals}) => {
  let projects: Project[] = []
  let dbPosts: BlogPost[] = []

  const supabaseClient = (locals as any)?.supabase || supabase

  const [author, cv, funding, contact, skillsGrouped, socials] =
    await Promise.all([
      fetchAuthorProfile(supabaseClient),
      fetchCvEntries(supabaseClient),
      fetchFundingLinks(supabaseClient),
      fetchContactInfo(supabaseClient),
      fetchGroupedSkills(supabaseClient),
      fetchSocials(supabaseClient)
    ])

  try {
    const headers: Record<string, string> = {
      Accept: 'application/vnd.github.v3+json',
      'User-Agent': 'fkp-www-sveltekit'
    }

    const token =
      platform?.env?.GITHUB_TOKEN ?? import.meta.env.VITE_GITHUB_TOKEN
    if (token) {
      headers['Authorization'] = `Bearer ${token}`
    }

    const res = await fetch(
      `${GITHUB_API_URL}?sort=stars&direction=desc&per_page=30&type=owner`,
      {headers}
    )

    if (res.ok) {
      const repos: GitHubRepo[] = await res.json()
      projects = repos
        .filter(repo => !repo.fork && !repo.archived)
        .map(repo => ({
          name: repo.name,
          desc: repo.description ?? 'No description provided.',
          tags: repo.topics.length > 0 ? repo.topics : [],
          url: repo.html_url,
          lang: repo.language ?? undefined,
          stars: repo.stargazers_count,
          licenseName: repo.license?.spdx_id ?? null,
          licenseUrl: repo.license ? `${repo.html_url}/blob/main/LICENSE` : null
        }))
    } else {
      console.error(`GitHub API error: ${res.status} ${res.statusText}`)
    }
  } catch (err) {
    console.error('Failed to fetch GitHub repos:', err)
  }

  try {
    const {data, error} = await supabase
      .from('posts')
      .select('*')
      .eq('published', true)
      .order('created_at', {ascending: false})
    if (!error && data) {
      dbPosts = await Promise.all(
        data.map(async post => {
          let readTime = '1 min read'
          let commentCount = 0
          try {
            const {data: urlData} = supabase.storage
              .from('blog-posts')
              .getPublicUrl(post.storage_path)
            const fileRes = await fetch(urlData.publicUrl)
            if (fileRes.ok) {
              const text = await fileRes.text()
              const words = text.trim().split(/\s+/).length
              const minutes = Math.max(1, Math.ceil(words / 200))
              readTime = `${minutes} min${minutes > 1 ? 's' : ''} read`
            }
          } catch (err) {
            console.error(err)
          }

          try {
            const {count} = await supabase
              .from('comments')
              .select('*', {count: 'exact', head: true})
              .eq('post_id', post.id)
              .eq('is_approved', true)
            commentCount = count ?? 0
          } catch (err) {
            console.error(err)
          }

          let viewsCount = 0
          try {
            const {count} = await supabase
              .from('post_views')
              .select('*', {count: 'exact', head: true})
              .eq('post_id', post.id)
            viewsCount = count ?? 0
          } catch (err) {
            console.error(err)
          }

          return {
            ...post,
            read_time: readTime,
            comment_count: commentCount,
            views_count: viewsCount
          }
        })
      )
    }
  } catch (err) {
    console.error(err)
  }

  return {
    projects,
    posts: dbPosts,
    author,
    cv,
    funding,
    contact,
    skills: skillsGrouped,
    socials
  }
}
