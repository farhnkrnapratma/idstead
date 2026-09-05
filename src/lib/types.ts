export type Theme = 'auto' | 'dark' | 'light';

export type Section =
  'home' | 'blog' | 'contact' | 'cv' | 'projects' | 'funding';

export interface NavItem {
  id: Section;
  label: string;
}

export interface SearchResult {
  type: 'post' | 'project';
  title: string;
  subtitle: string;
  url: string;
  tags?: string[];
}

export interface Post {
  id: string;
  title: string;
  slug: string;
  excerpt?: string | null;
  tags?: string[] | null;
  created_at?: string | null;
  read_time?: string | null;
  views_count?: number | null;
  comment_count?: number | null;
  banner_path?: string | null;
  collaborators?: string[] | null;
  published?: boolean;
}

export type BlogPost = Post;

export interface Comment {
  id: string;
  post_id: string;
  parent_id: string | null;
  author_name: string;
  content: string;
  is_anonymous: boolean;
  is_admin?: boolean;
  is_approved: boolean;
  created_at: string;
}

export interface Project {
  name: string;
  fullName: string;
  desc: string;
  tags: string[];
  url: string;
  cloneUrl: string;
  sshUrl: string;
  zipUrl: string;
  lang?: string;
  langColor?: string;
  stars: number;
  forks: number;
  branches: number;
  commits: number;
  latestCommitSha?: string;
  createdAt: string | null;
  pushedAt: string | null;
  licenseName: string | null;
  licenseUrl: string | null;
  openGraphImageUrl?: string;
}

export interface FormFieldContext {
  id?: string;
  label?: string;
  required?: boolean;
  hideAsterisk?: boolean;
  variant?: 'standard' | 'floating';
  error?: string;
  valid?: boolean;
  counter?: string;
}
