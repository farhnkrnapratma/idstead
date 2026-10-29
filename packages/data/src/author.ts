import type {
    AuthorProfile,
    ContactInfo,
    ResumeDocument,
    EducationItem,
    ExperienceItem,
    ProjectRepoRules,
    SkillCategoryGroup,
    SocialLink,
    SponsorshipLink
} from '@idstead/domain/author.ts';
import type { PublicOpenPgpKey } from '@idstead/domain/openpgpKey.ts';

export interface ResumeEntries {
    experience: ExperienceItem[];
    education: EducationItem[];
}

export interface AuthorRepository {
    profile(options?: { includeEmail?: boolean }): Promise<AuthorProfile | null>;
    socialLinks(): Promise<SocialLink[]>;
    fundingLinks(): Promise<SponsorshipLink[]>;
    contactLinks(): Promise<ContactInfo[]>;
    resumeEntries(): Promise<ResumeEntries>;
    skillGroups(): Promise<SkillCategoryGroup[]>;
    projectRepoRules(): Promise<ProjectRepoRules>;
    activeResumeDocument(): Promise<ResumeDocument | null>;
    activeOpenPgpKey(): Promise<PublicOpenPgpKey | null>;
    siteUrl(): Promise<string>;
}
