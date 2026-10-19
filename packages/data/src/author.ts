import type {
    AuthorProfile,
    ContactInfo,
    CvDocument,
    EducationItem,
    ExperienceItem,
    ProjectRepoRules,
    SkillCategoryGroup,
    SocialLink,
    SponsorshipLink
} from '@fkp/domain/author.ts';
import type { PublicOpenPgpKey } from '@fkp/domain/openpgpKey.ts';

export interface CvEntries {
    experience: ExperienceItem[];
    education: EducationItem[];
}

export interface AuthorRepository {
    profile(options?: { includeEmail?: boolean }): Promise<AuthorProfile | null>;
    socialLinks(): Promise<SocialLink[]>;
    fundingLinks(): Promise<SponsorshipLink[]>;
    contactLinks(): Promise<ContactInfo[]>;
    cvEntries(): Promise<CvEntries>;
    skillGroups(): Promise<SkillCategoryGroup[]>;
    projectRepoRules(): Promise<ProjectRepoRules>;
    activeCvDocument(): Promise<CvDocument | null>;
    activeOpenPgpKey(): Promise<PublicOpenPgpKey | null>;
    siteUrl(): Promise<string>;
}
