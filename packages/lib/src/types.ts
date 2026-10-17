export type Theme = 'auto' | 'dark' | 'light';

export type Section = 'home' | 'blog' | 'contact' | 'cv' | 'projects' | 'funding';

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
