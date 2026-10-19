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
