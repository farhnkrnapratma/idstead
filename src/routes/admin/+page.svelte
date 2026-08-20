<script lang="ts">
  import {page} from '$app/state';
  import {replaceState} from '$app/navigation';
  import {supabase} from '$lib/supabase';
  import {
    FileText,
    User,
    FileUser,
    Layers,
    Share2,
    Heart,
    Mail,
    Lock,
    ShieldCheck,
    ScrollText,
    Image as ImageIcon,
    ZoomIn,
    Trash2,
    ArrowUp,
    ArrowDown,
    Copy,
    ExternalLink,
    BadgeCheck,
    PlusCircle,
    Rocket,
    Cpu,
    X,
    Plus,
    Pencil,
    LogOut,
    Eye,
    EyeOff,
    Menu
  } from '@lucide/svelte';
  import hljs from 'highlight.js';
  import {a11yStore} from '$lib/stores/a11yStore.svelte';
  import {codeBlockPrefsStore} from '$lib/stores/codeBlockPrefsStore.svelte';
  import {resolveHljsTheme} from '$lib/utils/hljsTheme';
  import {renderMarkdown} from '$lib/markdown';
  import {
    enhanceCodeBlocks,
    splitHighlightedHtmlLines
  } from '$lib/utils/codeBlocks';
  import {onMount, tick, untrack} from 'svelte';
  import {SvelteSet} from 'svelte/reactivity';
  import {
    Dialog,
    Button,
    IconButton,
    Badge,
    Card,
    Textarea,
    FormField,
    Input,
    Select,
    Checkbox,
    ConfirmationDialog,
    CommentThread,
    LoadingState,
    EmptyState,
    ImageWithSkeleton,
    SkipLink,
    FilterToolbar,
    FilterSelect,
    FilterCheckboxGroup,
    DropdownSelect,
    SortControl,
    SearchResultCount,
    FilterChipGroup,
    FilterEmptyState,
    Pagination,
    RelativeTime,
    toastStore,
    createFilterSortStore,
    ThemeSelect,
    StatusBanner,
    formatReadTime,
    formatViewCount,
    formatAbsoluteDate,
    FormSection,
    FormActions,
    MarkdownEditor,
    PillInput,
    sanitizeInput,
    decodeHtmlEntities,
    splitEscapedCommas
  } from '$lib';

  import {themeStore} from '$lib/stores/themeStore.svelte';
  import {
    fetchAuthorProfile,
    fetchCvEntries,
    fetchSponsorship,
    fetchContactInfo,
    fetchSocials,
    fetchSkills,
    fetchActiveCvDocument,
    sanitizeIconClass,
    type AuthorProfile,
    type ExperienceItem,
    type EducationItem,
    type SponsorshipLink,
    type ContactInfo,
    type SocialLink,
    type SkillItem,
    type CvDocument
  } from '$lib/author';

  interface AdminPost {
    id: string;
    title: string;
    slug: string;
    published: boolean;
    storage_path: string;
    created_at: string;
    updated_at?: string | null;
    banner_path?: string | null;
    excerpt?: string | null;
    tags?: string[] | null;
    read_time?: string | null;
  }

  function getBannerUrl(bannerPath: string | null | undefined): string | null {
    if (!bannerPath) return null;
    const {data: res} = supabase.storage
      .from('blog-posts')
      .getPublicUrl(bannerPath);
    return res.publicUrl;
  }

  const failedBanners = new SvelteSet<string>();

  function markBannerFailed(postId: string) {
    failedBanners.add(postId);
  }

  let isLoading = $state(true);
  let posts = $state<AdminPost[]>([]);
  let isLoggingOut = $state(false);
  let adminUserEmail = $state('');

  const filterStore = createFilterSortStore({
    defaultSortField: 'date',
    defaultSortDir: 'desc'
  });

  let showDeletePostDialog = $state(false);
  let postToDelete = $state<AdminPost | null>(null);
  let showDeleteCommentDialog = $state(false);
  let commentIdToDelete = $state<string | null>(null);
  let showClearAuthorDialog = $state(false);
  let showDeleteCvDocDialog = $state(false);
  let showAvatarPreviewDialog = $state(false);

  interface AdminComment {
    id: string;
    post_id: string;
    parent_id: string | null;
    author_name: string;
    content: string;
    is_anonymous?: boolean;
    is_approved: boolean;
    created_at: string;
    posts?: {title: string};
  }

  let comments = $state<AdminComment[]>([]);
  let replyTo = $state<AdminComment | null>(null);
  let commentContent = $state('');
  let isSubmitting = $state(false);

  let initialTab = page.url.searchParams.get('tab');

  let activeAdminTab = $state<
    | 'posts'
    | 'profile'
    | 'resume'
    | 'skills'
    | 'socials'
    | 'sponsorship'
    | 'contact'
    | 'privacy'
    | 'security'
    | 'terms'
  >((initialTab as any) || 'posts');
  let sidebarMobileOpen = $state(false);

  function selectTab(id: typeof activeAdminTab) {
    activeAdminTab = id;
    sidebarMobileOpen = false;
    const url = new URL(page.url);
    url.searchParams.set('tab', id);
    replaceState(url, page.state);
  }

  type Theme = 'auto' | 'dark' | 'light';

  const MONTHS = [
    'January',
    'February',
    'March',
    'April',
    'May',
    'June',
    'July',
    'August',
    'September',
    'October',
    'November',
    'December'
  ] as const;

  const currentYear = new Date().getFullYear();

  function getStartYearOptions() {
    const years: number[] = [];
    for (let y = currentYear; y >= currentYear - 100; y--) {
      years.push(y);
    }
    return years;
  }

  function getEndYearOptions(startYear?: number | null) {
    const start = startYear || currentYear;
    const years: number[] = [];
    for (let y = start; y <= currentYear + 100; y++) {
      years.push(y);
    }
    return years;
  }

  const EMPLOYMENT_TYPES = [
    'Full-time',
    'Part-time',
    'Self-employed',
    'Freelance',
    'Contract',
    'Internship',
    'Apprenticeship',
    'Seasonal'
  ] as const;

  const LOCATION_TYPES = ['On-Site', 'Remote', 'Hybrid'] as const;

  let authorState = $state<AuthorProfile>({
    name: '',
    username: '',
    headline: '',
    jobTitle: '',
    bio: '',
    avatar: '',
    email: '',
    city: '',
    postalCode: '',
    country: '',
    siteUrl: '',
    skills: []
  });

  let legalPagesData = $state<Record<string, {title: string; content: string}>>(
    {
      privacy: {title: 'Privacy Policy', content: ''},
      security: {title: 'Security Policy', content: ''},
      terms: {title: 'Terms of Service', content: ''}
    }
  );
  let isSavingLegal = $state(false);
  let legalSaveSuccess = $state(false);
  let legalSaveError = $state('');

  let isDark = $state(false);

  const hljsTheme = $derived(
    resolveHljsTheme(
      a11yStore.current.highContrast,
      isDark,
      codeBlockPrefsStore.current.colorScheme
    )
  );

  onMount(() => {
    isDark = document.documentElement.classList.contains('dark');
    const themeObserver = new MutationObserver(() => {
      isDark = document.documentElement.classList.contains('dark');
    });
    themeObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class']
    });
    return () => themeObserver.disconnect();
  });

  async function loadLegalPagesFromSupabase() {
    try {
      const {data, error} = await supabase
        .from('db_legals')
        .select('slug, title, content');
      if (!error && data && data.length > 0) {
        for (const item of data) {
          if (item.slug && legalPagesData[item.slug]) {
            legalPagesData[item.slug] = {
              title: item.title || legalPagesData[item.slug].title || '',
              content: item.content ?? legalPagesData[item.slug].content ?? ''
            };
          }
        }
      }
    } catch {}
  }

  async function handleSaveLegalPage(
    targetSlug?: 'privacy' | 'security' | 'terms',
    e?: SubmitEvent
  ) {
    if (e) e.preventDefault();
    if (isSavingLegal) return;
    const slugToSave =
      targetSlug || (activeAdminTab as 'privacy' | 'security' | 'terms');
    if (!slugToSave || !legalPagesData[slugToSave]) return;

    isSavingLegal = true;
    legalSaveError = '';
    legalSaveSuccess = false;

    const pageToSave = legalPagesData[slugToSave];
    try {
      const {error} = await supabase.rpc('db_save_legal', {
        p_slug: slugToSave,
        p_title: pageToSave.title,
        p_content: pageToSave.content
      });

      if (error) {
        const {error: upsertErr} = await supabase
          .from('db_legals')
          .upsert(
            {
              slug: slugToSave,
              title: pageToSave.title,
              content: pageToSave.content,
              updated_at: new Date().toISOString()
            },
            {onConflict: 'slug'}
          );

        if (upsertErr) {
          throw upsertErr;
        }
      }

      legalSaveSuccess = true;
      toastStore.success(`${pageToSave.title} saved successfully`);
      setTimeout(() => (legalSaveSuccess = false), 3000);
    } catch (err: any) {
      legalSaveError = err?.message || 'Failed to save legal page';
      toastStore.error(`Error: ${legalSaveError}`);
    } finally {
      isSavingLegal = false;
    }
  }
  let isSavingAuthor = $state(false);
  let authorSaveSuccess = $state(false);
  let authorSaveError = $state('');

  const authorEmailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const authorUrlRegex = /^(https?:\/\/|\/)/;

  let authorErrors = $state({
    name: '',
    username: '',
    jobTitle: '',
    headline: '',
    avatar: '',
    email: '',
    city: '',
    postalCode: '',
    country: '',
    siteUrl: '',
    bio: ''
  });

  let authorValid = $state({
    name: false,
    username: false,
    jobTitle: false,
    headline: false,
    avatar: false,
    email: false,
    city: false,
    postalCode: false,
    country: false,
    siteUrl: false,
    bio: false
  });

  let authorInitial = $state<typeof authorState | null>(null);

  const authorIsDirty = $derived(
    authorInitial !== null
      && JSON.stringify({
        name: authorState.name,
        username: authorState.username,
        jobTitle: authorState.jobTitle,
        headline: authorState.headline,
        avatar: authorState.avatar,
        email: authorState.email,
        city: authorState.city,
        postalCode: authorState.postalCode,
        country: authorState.country,
        siteUrl: authorState.siteUrl,
        bio: authorState.bio
      })
        !== JSON.stringify({
          name: authorInitial.name,
          username: authorInitial.username,
          jobTitle: authorInitial.jobTitle,
          headline: authorInitial.headline,
          avatar: authorInitial.avatar,
          email: authorInitial.email,
          city: authorInitial.city,
          postalCode: authorInitial.postalCode,
          country: authorInitial.country,
          siteUrl: authorInitial.siteUrl,
          bio: authorInitial.bio
        })
  );

  const avatarPreviewUrl = $derived(authorState.avatar.trim());

  function debounceAuthor<T extends unknown[]>(
    cb: (...args: T) => void,
    ms: number
  ) {
    let timer: ReturnType<typeof setTimeout>;
    return (...args: T) => {
      clearTimeout(timer);
      timer = setTimeout(() => cb(...args), ms);
    };
  }

  const validateAuthorField = debounceAuthor(
    (field: keyof typeof authorErrors) => {
      const v =
        (authorState[field as keyof typeof authorState] as string)?.trim()
        || '';
      if (field === 'email') {
        if (!v) {
          authorErrors.email = 'Email is required.';
          authorValid.email = false;
        } else if (!authorEmailRegex.test(v)) {
          authorErrors.email = 'Please enter a valid email address.';
          authorValid.email = false;
        } else {
          authorErrors.email = '';
          authorValid.email = true;
        }
      } else if (field === 'avatar' || field === 'siteUrl') {
        if (!v) {
          authorErrors[field] =
            field === 'avatar' ?
              'Avatar URL is required.'
            : 'Site URL is required.';
          authorValid[field] = false;
        } else if (!authorUrlRegex.test(v)) {
          authorErrors[field] = 'Must start with http:// or https://';
          authorValid[field] = false;
        } else {
          authorErrors[field] = '';
          authorValid[field] = true;
        }
      } else {
        if (!v) {
          const labels: Record<string, string> = {
            name: 'Name',
            username: 'Username',
            jobTitle: 'Job title',
            headline: 'Headline',
            city: 'City',
            postalCode: 'Postal code',
            country: 'Country',
            bio: 'Description'
          };
          authorErrors[field] = `${labels[field] || 'This field'} is required.`;
          authorValid[field as keyof typeof authorValid] = false;
        } else {
          authorErrors[field] = '';
          authorValid[field as keyof typeof authorValid] = true;
        }
      }
    },
    400
  );

  function onAuthorInput(field: keyof typeof authorErrors) {
    authorErrors[field] = '';
    authorValid[field as keyof typeof authorValid] = false;
    validateAuthorField(field);
  }

  function validateAllAuthorFields(): boolean {
    const fields = Object.keys(authorErrors) as (keyof typeof authorErrors)[];
    let valid = true;
    for (const field of fields) {
      const v =
        (authorState[field as keyof typeof authorState] as string)?.trim()
        || '';
      if (field === 'email') {
        if (!v || !authorEmailRegex.test(v)) {
          authorErrors[field] =
            !v ? 'Email is required.' : 'Please enter a valid email address.';
          authorValid[field] = false;
          valid = false;
        } else {
          authorErrors[field] = '';
          authorValid[field] = true;
        }
      } else if (field === 'avatar' || field === 'siteUrl') {
        if (!v) {
          authorErrors[field] =
            field === 'avatar' ?
              'Avatar URL is required.'
            : 'Site URL is required.';
          authorValid[field] = false;
          valid = false;
        } else if (!authorUrlRegex.test(v)) {
          authorErrors[field] = 'Must start with http:// or https://';
          authorValid[field] = false;
          valid = false;
        } else {
          authorErrors[field] = '';
          authorValid[field] = true;
        }
      } else {
        if (!v) {
          const labels: Record<string, string> = {
            name: 'Name',
            username: 'Username',
            jobTitle: 'Job title',
            headline: 'Headline',
            city: 'City',
            postalCode: 'Postal code',
            country: 'Country',
            bio: 'Description'
          };
          authorErrors[field] = `${labels[field] || 'This field'} is required.`;
          authorValid[field as keyof typeof authorValid] = false;
          valid = false;
        } else {
          authorErrors[field] = '';
          authorValid[field as keyof typeof authorValid] = true;
        }
      }
    }
    return valid;
  }

  let cvState = $state<{
    experience: ExperienceItem[];
    education: EducationItem[];
  }>({experience: [], education: []});

  let skillsState = $state<SkillItem[]>([]);
  let socialState = $state<SocialLink[]>([]);
  let sponsorshipState = $state<SponsorshipLink[]>([]);
  let contactState = $state<ContactInfo[]>([]);

  let cvInitial = $state<typeof cvState | null>(null);
  let skillsInitial = $state<SkillItem[] | null>(null);
  let socialInitial = $state<SocialLink[] | null>(null);
  let sponsorshipInitial = $state<SponsorshipLink[] | null>(null);
  let contactInitial = $state<ContactInfo[] | null>(null);

  const cvIsDirty = $derived(
    cvInitial !== null && JSON.stringify(cvState) !== JSON.stringify(cvInitial)
  );
  const skillsIsDirty = $derived(
    skillsInitial !== null
      && JSON.stringify(skillsState) !== JSON.stringify(skillsInitial)
  );
  const socialIsDirty = $derived(
    socialInitial !== null
      && JSON.stringify(socialState) !== JSON.stringify(socialInitial)
  );
  const sponsorshipIsDirty = $derived(
    sponsorshipInitial !== null
      && JSON.stringify(sponsorshipState) !== JSON.stringify(sponsorshipInitial)
  );
  const contactIsDirty = $derived(
    contactInitial !== null
      && JSON.stringify(contactState) !== JSON.stringify(contactInitial)
  );
  let cvDocState = $state<CvDocument>({
    filename: '',
    fileUrl: '',
    hash: '',
    isActive: true
  });
  let isGeneratingPdf = $state(false);

  function debounceAdmin<T extends unknown[]>(
    cb: (...args: T) => void,
    ms: number
  ) {
    let timer: ReturnType<typeof setTimeout>;
    return (...args: T) => {
      clearTimeout(timer);
      timer = setTimeout(() => cb(...args), ms);
    };
  }

  let experienceErrors = $state<Record<number, Record<string, string>>>({});
  let experienceValid = $state<Record<number, Record<string, boolean>>>({});
  let educationErrors = $state<Record<number, Record<string, string>>>({});
  let educationValid = $state<Record<number, Record<string, boolean>>>({});
  let skillsErrors = $state<Record<number, Record<string, string>>>({});
  let skillsValid = $state<Record<number, Record<string, boolean>>>({});
  let socialErrors = $state<Record<number, Record<string, string>>>({});
  let socialValid = $state<Record<number, Record<string, boolean>>>({});
  let sponsorshipErrors = $state<Record<number, Record<string, string>>>({});
  let sponsorshipValid = $state<Record<number, Record<string, boolean>>>({});
  let contactErrors = $state<Record<number, Record<string, string>>>({});
  let contactValid = $state<Record<number, Record<string, boolean>>>({});

  const urlRegex = /^(https?:\/\/|mailto:|tel:).+/i;

  function validateRequiredField(
    errors: Record<number, Record<string, string>>,
    valid: Record<number, Record<string, boolean>>,
    idx: number,
    field: string,
    label: string,
    value: string,
    isUrl = false
  ): boolean {
    if (!errors[idx]) errors[idx] = {};
    if (!valid[idx]) valid[idx] = {};
    const v = value.trim();
    if (!v) {
      errors[idx][field] = `${label} is required.`;
      valid[idx][field] = false;
      return false;
    }
    if (isUrl && !urlRegex.test(v)) {
      errors[idx][field] =
        'Must start with http://, https://, mailto:, or tel:';
      valid[idx][field] = false;
      return false;
    }
    errors[idx][field] = '';
    valid[idx][field] = true;
    return true;
  }

  function clearFieldError(
    errors: Record<number, Record<string, string>>,
    valid: Record<number, Record<string, boolean>>,
    idx: number,
    field: string
  ) {
    if (errors[idx]) errors[idx][field] = '';
    if (valid[idx]) valid[idx][field] = false;
  }

  const validateExperienceField = debounceAdmin(
    (idx: number, field: keyof ExperienceItem, label: string) => {
      const value = String(cvState.experience[idx]?.[field] ?? '');
      validateRequiredField(
        experienceErrors,
        experienceValid,
        idx,
        field,
        label,
        value
      );
    },
    400
  );

  const validateEducationField = debounceAdmin(
    (idx: number, field: keyof EducationItem, label: string) => {
      const value = String(cvState.education[idx]?.[field] ?? '');
      validateRequiredField(
        educationErrors,
        educationValid,
        idx,
        field,
        label,
        value
      );
    },
    400
  );

  const validateSkillField = debounceAdmin((idx: number) => {
    validateRequiredField(
      skillsErrors,
      skillsValid,
      idx,
      'category',
      'Area of expertise',
      skillsState[idx]?.category || ''
    );
  }, 400);

  const validateSocialField = debounceAdmin(
    (idx: number, field: 'platform' | 'url') => {
      const labels = {platform: 'Platform', url: 'URL'};
      validateRequiredField(
        socialErrors,
        socialValid,
        idx,
        field,
        labels[field],
        socialState[idx]?.[field] || '',
        field === 'url'
      );
    },
    400
  );

  const validateSponsorshipField = debounceAdmin(
    (idx: number, field: 'platform' | 'displayValue' | 'url') => {
      const labels = {
        platform: 'Platform',
        displayValue: 'Display text',
        url: 'URL'
      };
      validateRequiredField(
        sponsorshipErrors,
        sponsorshipValid,
        idx,
        field,
        labels[field],
        sponsorshipState[idx]?.[field] || '',
        field === 'url'
      );
    },
    400
  );

  const validateContactField = debounceAdmin(
    (idx: number, field: 'platform' | 'displayValue' | 'href') => {
      const labels = {
        platform: 'Platform',
        displayValue: 'Display text',
        href: 'URL'
      };
      validateRequiredField(
        contactErrors,
        contactValid,
        idx,
        field,
        labels[field],
        contactState[idx]?.[field] || '',
        field === 'href'
      );
    },
    400
  );

  function validateAllExperience(): boolean {
    let ok = true;
    cvState.experience.forEach((exp, idx) => {
      const fields: [keyof ExperienceItem, string][] = [
        ['title', 'Title'],
        ['company', 'Company'],
        ['location', 'Location'],
        ['description', 'Description']
      ];
      for (const [field, label] of fields) {
        if (
          !validateRequiredField(
            experienceErrors,
            experienceValid,
            idx,
            field,
            label,
            String(exp[field] ?? '')
          )
        )
          ok = false;
      }
    });
    return ok;
  }

  function validateAllEducation(): boolean {
    let ok = true;
    cvState.education.forEach((edu, idx) => {
      const fields: [keyof EducationItem, string][] = [
        ['institution', 'Institution'],
        ['degree', 'Degree'],
        ['field', 'Field of study'],
        ['grade', 'Grade'],
        ['description', 'Description']
      ];
      for (const [field, label] of fields) {
        if (
          !validateRequiredField(
            educationErrors,
            educationValid,
            idx,
            field,
            label,
            String(edu[field] ?? '')
          )
        )
          ok = false;
      }
    });
    return ok;
  }

  function validateAllSkills(): boolean {
    let ok = true;
    skillsState.forEach((item, idx) => {
      if (
        !validateRequiredField(
          skillsErrors,
          skillsValid,
          idx,
          'category',
          'Area of expertise',
          item.category || ''
        )
      )
        ok = false;
    });
    return ok;
  }

  function validateAllSocials(): boolean {
    let ok = true;
    socialState.forEach((item, idx) => {
      if (
        !validateRequiredField(
          socialErrors,
          socialValid,
          idx,
          'platform',
          'Platform',
          item.platform || ''
        )
      )
        ok = false;
      if (
        !validateRequiredField(
          socialErrors,
          socialValid,
          idx,
          'url',
          'URL',
          item.url || '',
          true
        )
      )
        ok = false;
    });
    return ok;
  }

  function validateAllSponsorship(): boolean {
    let ok = true;
    sponsorshipState.forEach((item, idx) => {
      if (
        !validateRequiredField(
          sponsorshipErrors,
          sponsorshipValid,
          idx,
          'platform',
          'Platform',
          item.platform || ''
        )
      )
        ok = false;
      if (
        !validateRequiredField(
          sponsorshipErrors,
          sponsorshipValid,
          idx,
          'displayValue',
          'Display text',
          item.displayValue || ''
        )
      )
        ok = false;
      if (
        !validateRequiredField(
          sponsorshipErrors,
          sponsorshipValid,
          idx,
          'url',
          'URL',
          item.url || '',
          true
        )
      )
        ok = false;
    });
    return ok;
  }

  function validateAllContact(): boolean {
    let ok = true;
    contactState.forEach((item, idx) => {
      if (
        !validateRequiredField(
          contactErrors,
          contactValid,
          idx,
          'platform',
          'Platform',
          item.platform || ''
        )
      )
        ok = false;
      if (
        !validateRequiredField(
          contactErrors,
          contactValid,
          idx,
          'displayValue',
          'Display text',
          item.displayValue || ''
        )
      )
        ok = false;
      if (
        !validateRequiredField(
          contactErrors,
          contactValid,
          idx,
          'href',
          'URL',
          item.href || '',
          true
        )
      )
        ok = false;
    });
    return ok;
  }

  let isClearingAuthor = $state(false);

  let pdfUploadError = $state('');
  let pdfUploadSuccess = $state('');

  let isSavingCv = $state(false);
  let cvSaveSuccess = $state(false);
  let isSavingSkills = $state(false);
  let skillsSaveSuccess = $state(false);
  let isSavingSocials = $state(false);
  let socialsSaveSuccess = $state(false);
  let isSavingSponsorship = $state(false);
  let sponsorshipSaveSuccess = $state(false);
  let isSavingContact = $state(false);
  let contactSaveSuccess = $state(false);

  function parsePastedSkillsText(text: string): {
    category: string | null;
    skills: string[];
  } {
    const colonIdx = text.indexOf(':');
    if (colonIdx === -1) {
      return {category: null, skills: splitEscapedCommas(text)};
    }
    const category = text.slice(0, colonIdx).trim();
    return {
      category: category || null,
      skills: splitEscapedCommas(text.slice(colonIdx + 1))
    };
  }

  function mergeSkills(existing: string[], toAdd: string[]): string[] {
    const result = [...existing];
    for (const s of toAdd) {
      if (s && !result.includes(s)) result.push(s);
    }
    return result;
  }

  function handleCategoryPaste(idx: number, e: ClipboardEvent) {
    const text = e.clipboardData?.getData('text/plain') ?? '';
    const parsed = parsePastedSkillsText(text);
    if (parsed.category === null) return;
    e.preventDefault();
    skillsState[idx].category = parsed.category;
    skillsState[idx].skills = mergeSkills(
      skillsState[idx].skills,
      parsed.skills
    );
    clearFieldError(skillsErrors, skillsValid, idx, 'category');
    validateSkillField(idx);
  }

  function handleSkillsSetPaste(idx: number, e: ClipboardEvent) {
    const text = e.clipboardData?.getData('text/plain') ?? '';
    const parsed = parsePastedSkillsText(text);
    if (parsed.skills.length === 0 && parsed.category === null) return;
    e.preventDefault();
    if (parsed.category !== null) {
      skillsState[idx].category = parsed.category;
      clearFieldError(skillsErrors, skillsValid, idx, 'category');
      validateSkillField(idx);
    }
    skillsState[idx].skills = mergeSkills(
      skillsState[idx].skills,
      parsed.skills
    );
    (e.currentTarget as HTMLInputElement).value = '';
  }

  const statusFilter = $derived(filterStore.filters['status']?.[0] || 'all');

  const allPostTags = $derived.by(() => {
    const set = new SvelteSet<string>();
    for (const post of posts) {
      if (post.tags) {
        post.tags.forEach(t => set.add(decodeHtmlEntities(t)));
      }
    }
    return Array.from(set).sort();
  });

  const postViewsMap = $state(new Map<string, number>());

  async function fetchPostViews(postId: string) {
    if (postViewsMap.has(postId)) return;
    try {
      const res = await fetch(`/api/v1/blog/views?postId=${postId}`);
      if (res.ok) {
        const data = await res.json();
        postViewsMap.set(postId, data.views || 0);
      }
    } catch (err) {
      console.error('Failed to fetch views for post:', postId, err);
    }
  }

  $effect(() => {
    if (posts.length > 0) {
      posts.forEach(post => fetchPostViews(post.id));
    }
  });

  function getPostComments(postId: string): AdminComment[] {
    return comments.filter(c => c.post_id === postId);
  }

  let filteredPosts = $derived.by(() => {
    let result = [...posts];

    if (filterStore.search.trim()) {
      const q = filterStore.search.toLowerCase().trim();
      result = result.filter(
        p =>
          p.title.toLowerCase().includes(q)
          || p.slug.toLowerCase().includes(q)
          || (p.excerpt && p.excerpt.toLowerCase().includes(q))
      );
    }

    if (statusFilter === 'published') {
      result = result.filter(p => p.published);
    } else if (statusFilter === 'draft') {
      result = result.filter(p => !p.published);
    }

    const selectedTags = filterStore.filters['tag'] || [];
    if (selectedTags.length > 0) {
      result = result.filter(
        p => p.tags && p.tags.some(t => selectedTags.includes(t))
      );
    }

    const {field, direction} = filterStore.sort;
    const mult = direction === 'asc' ? 1 : -1;

    result.sort((a, b) => {
      if (field === 'date') {
        return (
          mult
          * (new Date(a.created_at).getTime()
            - new Date(b.created_at).getTime())
        );
      }
      if (field === 'title') {
        return mult * a.title.localeCompare(b.title);
      }
      if (field === 'status') {
        return mult * (Number(a.published) - Number(b.published));
      }
      if (field === 'views') {
        const vA = postViewsMap.get(a.id) ?? 0;
        const vB = postViewsMap.get(b.id) ?? 0;
        return mult * (vA - vB);
      }
      if (field === 'comments') {
        const cA = getPostComments(a.id).length;
        const cB = getPostComments(b.id).length;
        return mult * (cA - cB);
      }
      if (field === 'readingTime') {
        const rA = parseInt(a.read_time || '0', 10);
        const rB = parseInt(b.read_time || '0', 10);
        return mult * (rA - rB);
      }
      return 0;
    });

    return result;
  });

  const POSTS_PAGE_SIZE = 10;

  let postsPage = $state(1);

  const postsTotalPages = $derived(
    Math.max(1, Math.ceil(filteredPosts.length / POSTS_PAGE_SIZE))
  );
  const postsPageClamped = $derived(Math.min(postsPage, postsTotalPages));
  const paginatedPosts = $derived(
    filteredPosts.slice(
      (postsPageClamped - 1) * POSTS_PAGE_SIZE,
      postsPageClamped * POSTS_PAGE_SIZE
    )
  );

  $effect(() => {
    void filterStore.search;
    void filterStore.filters;
    void filterStore.sort;
    untrack(() => {
      postsPage = 1;
    });
  });

  const expandedPostIds = new SvelteSet<string>();

  function toggleComments(postId: string) {
    if (expandedPostIds.has(postId)) {
      expandedPostIds.delete(postId);
    } else {
      expandedPostIds.add(postId);
    }
  }

  async function handleAdminSubmit(
    e: SubmitEvent,
    parentId: string,
    postId: string
  ) {
    e.preventDefault();
    if (isSubmitting) return;

    const trimmed = commentContent.trim();
    if (!trimmed) return;

    isSubmitting = true;
    try {
      const {data, error} = await supabase
        .from('db_comments')
        .insert({
          post_id: postId,
          parent_id: parentId,
          author_name: authorState.name,
          content: sanitizeInput(trimmed),
          is_anonymous: false,
          is_approved: true
        })
        .select('*')
        .single();

      if (error) throw error;

      if (data) {
        const postObj = posts.find(p => p.id === postId);
        const newComment: AdminComment = {
          ...data,
          posts: {title: postObj?.title || ''}
        };
        comments = [...comments, newComment];
        commentContent = '';
        replyTo = null;
        toastStore.success('Reply posted.');
      }
    } catch (err) {
      console.error('Error posting admin reply:', err);
      toastStore.error('Failed to post reply.');
    } finally {
      isSubmitting = false;
    }
  }

  let sessionTimeoutMultiplier = $state(1);
  let BASE_IDLE_TIMEOUT_MS = 30 * 60 * 1000;
  let idleWarnTimer: ReturnType<typeof setTimeout>;
  let showSessionTimeoutDialog = $state(false);
  let countdownSeconds = $state(30);
  let countdownInterval: ReturnType<typeof setInterval>;

  function startIdleTimer() {
    clearTimeout(idleWarnTimer);
    clearInterval(countdownInterval);
    const warnMs = BASE_IDLE_TIMEOUT_MS * sessionTimeoutMultiplier - 30000;

    idleWarnTimer = setTimeout(() => {
      showSessionTimeoutDialog = true;
      countdownSeconds = 30;
      countdownInterval = setInterval(() => {
        countdownSeconds -= 1;
        if (countdownSeconds <= 0) {
          clearInterval(countdownInterval);
          handleLogout();
        }
      }, 1000);
    }, warnMs);
  }

  async function handleExtendSession() {
    sessionTimeoutMultiplier *= 2;
    showSessionTimeoutDialog = false;
    clearInterval(countdownInterval);
    try {
      await supabase.auth.refreshSession();
    } catch (err) {
      console.error('Failed to refresh session:', err);
    }
    startIdleTimer();
  }

  const ACTIVITY_EVENTS = [
    'mousemove',
    'mousedown',
    'keydown',
    'scroll',
    'touchstart'
  ] as const;

  function handleUserActivity() {
    if (!showSessionTimeoutDialog) {
      startIdleTimer();
    }
  }

  onMount(() => {
    (async () => {
      const {data: sessionData} = await supabase.auth.getSession();
      if (!sessionData.session) {
        window.location.href = '/admin/login';
        return;
      }

      if (sessionData.session.user?.email) {
        adminUserEmail = sessionData.session.user.email;
      }

      void loadLegalPagesFromSupabase();

      const pendingToast = sessionStorage.getItem('admin_toast');
      if (pendingToast) {
        sessionStorage.removeItem('admin_toast');
        try {
          const {message, type} = JSON.parse(pendingToast);
          if (message) toastStore.show(message, type);
        } catch (err) {
          console.error('Failed to parse pending toast:', err);
        }
      }

      startIdleTimer();
      ACTIVITY_EVENTS.forEach(evt =>
        window.addEventListener(evt, handleUserActivity, {passive: true})
      );

      try {
        await Promise.allSettled([
          fetchPosts(),
          fetchComments(),
          loadAdminData(),
          loadLegalPagesFromSupabase()
        ]);
      } catch (err) {
        console.error('Error loading admin dashboard data:', err);
      } finally {
        isLoading = false;
      }
    })();

    return () => {
      clearTimeout(idleWarnTimer);
      clearInterval(countdownInterval);
      if (typeof window !== 'undefined') {
        ACTIVITY_EVENTS.forEach(evt =>
          window.removeEventListener(evt, handleUserActivity)
        );
      }
    };
  });

  async function loadAdminData() {
    try {
      const [p, cv, sp, ct, soc, sk, doc] = await Promise.all([
        fetchAuthorProfile(supabase, {includeEmail: true}),
        fetchCvEntries(supabase),
        fetchSponsorship(supabase),
        fetchContactInfo(supabase),
        fetchSocials(supabase),
        fetchSkills(supabase),
        fetchActiveCvDocument(supabase)
      ]);
      if (p) authorState = p;
      authorInitial = {...authorState};
      if (cv) cvState = cv;
      cvInitial = $state.snapshot(cvState);
      if (sp) sponsorshipState = sp;
      sponsorshipInitial = $state.snapshot(sponsorshipState);
      if (ct) contactState = ct;
      contactInitial = $state.snapshot(contactState);
      if (soc) socialState = soc;
      socialInitial = $state.snapshot(socialState);
      if (sk) skillsState = sk;
      skillsInitial = $state.snapshot(skillsState);
      cvDocState = doc || {
        filename: '',
        fileUrl: '',
        hash: '',
        isActive: false
      };
    } catch (err) {
      console.error('Failed to load admin supplementary data:', err);
    }
  }

  async function fetchPosts() {
    try {
      const {data, error} = await supabase
        .from('db_posts')
        .select(
          'id, title, slug, published, storage_path, created_at, updated_at, banner_path, excerpt, tags'
        )
        .order('created_at', {ascending: false});

      if (error) throw error;

      const rawPosts = data || [];
      posts = rawPosts.map(post => ({...post, read_time: '1 min read'}));

      void (async () => {
        const postsWithReadTime = await Promise.all(
          rawPosts.map(async post => {
            let readTime = '1 min read';
            if (post.storage_path) {
              try {
                const {data: urlData} = supabase.storage
                  .from('blog-posts')
                  .getPublicUrl(post.storage_path);
                const controller = new AbortController();
                const timer = setTimeout(() => controller.abort(), 2000);
                const fileRes = await fetch(urlData.publicUrl, {
                  signal: controller.signal
                });
                clearTimeout(timer);
                if (fileRes.ok) {
                  const text = await fileRes.text();
                  const words = text.trim().split(/\s+/).filter(Boolean).length;
                  const minutes = Math.max(1, Math.ceil(words / 200));
                  readTime = `${minutes} min${minutes > 1 ? 's' : ''} read`;
                }
              } catch {}
            }
            return {...post, read_time: readTime};
          })
        );
        posts = postsWithReadTime;
      })();
    } catch (err) {
      console.error('Error fetching admin posts:', err);
    }
  }

  async function fetchComments() {
    try {
      const {data, error} = await supabase
        .from('db_comments')
        .select('*, posts:post_id(title)')
        .order('created_at', {ascending: false});

      if (error) throw error;
      comments = (data as any) || [];
    } catch (err) {
      console.error('Error fetching admin comments:', err);
    }
  }

  async function handleLogout() {
    isLoggingOut = true;
    try {
      await supabase.auth.signOut();
      window.location.href = '/admin/login';
    } catch (err) {
      console.error('Error signing out:', err);
      isLoggingOut = false;
    }
  }

  async function handleTogglePublished(post: AdminPost) {
    try {
      const nextPublished = !post.published;
      const {error} = await supabase
        .from('db_posts')
        .update({published: nextPublished})
        .eq('id', post.id);

      if (error) throw error;
      posts = posts.map(p =>
        p.id === post.id ? {...p, published: nextPublished} : p
      );
      toastStore.success(
        nextPublished ? 'Post published.' : 'Post unpublished.'
      );
    } catch (err) {
      console.error('Error updating post published status:', err);
      toastStore.error('Failed to update post status.');
    }
  }

  function confirmDeletePost(post: AdminPost) {
    postToDelete = post;
    showDeletePostDialog = true;
  }

  async function executeDeletePost() {
    if (!postToDelete) return;
    try {
      if (postToDelete.storage_path) {
        await supabase.storage
          .from('blog-posts')
          .remove([postToDelete.storage_path]);
      }
      if (postToDelete.banner_path) {
        await supabase.storage
          .from('blog-posts')
          .remove([postToDelete.banner_path]);
      }
      const {error} = await supabase
        .from('db_posts')
        .delete()
        .eq('id', postToDelete.id);
      if (error) throw error;
      posts = posts.filter(p => p.id !== postToDelete!.id);
      toastStore.success('Post deleted.');
    } catch (err) {
      console.error('Error deleting post:', err);
      toastStore.error('Failed to delete post.');
    } finally {
      showDeletePostDialog = false;
      postToDelete = null;
    }
  }

  function confirmDeleteComment(id: string) {
    commentIdToDelete = id;
    showDeleteCommentDialog = true;
  }

  function getCommentDescendantIds(
    targetId: string,
    allComments: AdminComment[]
  ): string[] {
    const ids = new SvelteSet<string>([targetId]);
    let prevSize = 0;
    while (ids.size > prevSize) {
      prevSize = ids.size;
      for (const c of allComments) {
        if (c.parent_id && ids.has(c.parent_id)) {
          ids.add(c.id);
        }
      }
    }
    return Array.from(ids);
  }

  async function executeDeleteComment() {
    if (!commentIdToDelete) return;
    try {
      const idsToDelete = getCommentDescendantIds(commentIdToDelete, comments);

      const {error} = await supabase
        .from('db_comments')
        .delete()
        .in('id', idsToDelete);
      if (error) throw error;

      comments = comments.filter(c => !idsToDelete.includes(c.id));
      toastStore.success('Comment deleted.');
    } catch (err) {
      console.error('Error deleting comment:', err);
      toastStore.error('Failed to delete comment.');
    } finally {
      showDeleteCommentDialog = false;
      commentIdToDelete = null;
    }
  }

  async function toggleCommentApproval(comment: AdminComment) {
    try {
      const nextApproved = !comment.is_approved;
      const {error} = await supabase
        .from('db_comments')
        .update({is_approved: nextApproved})
        .eq('id', comment.id);

      if (error) throw error;
      comments = comments.map(c =>
        c.id === comment.id ? {...c, is_approved: nextApproved} : c
      );
      toastStore.success(
        nextApproved ? 'Comment approved.' : 'Comment held for review.'
      );
    } catch (err) {
      console.error('Error toggling comment approval:', err);
      toastStore.error('Failed to update comment.');
    }
  }

  function moveArrayItem<T>(
    arr: T[],
    fromIndex: number,
    direction: 'up' | 'down'
  ): T[] {
    const toIndex = direction === 'up' ? fromIndex - 1 : fromIndex + 1;
    if (toIndex < 0 || toIndex >= arr.length) return arr;
    const updated = [...arr];
    const [moved] = updated.splice(fromIndex, 1);
    updated.splice(toIndex, 0, moved);
    return updated;
  }

  async function handleSaveAuthor(e: SubmitEvent) {
    e.preventDefault();
    if (isSavingAuthor) return;
    if (!validateAllAuthorFields()) return;
    isSavingAuthor = true;
    authorSaveSuccess = false;
    authorSaveError = '';
    try {
      let cleanUsername = authorState.username.trim();
      if (cleanUsername.startsWith('@')) {
        cleanUsername = cleanUsername.replace(/^@+/, '');
      }
      cleanUsername = cleanUsername.replace(/\s+/g, '');

      const payload = {
        name: sanitizeInput(authorState.name.trim()),
        username: sanitizeInput(cleanUsername),
        headline: sanitizeInput(authorState.headline.trim()),
        job_title: sanitizeInput(authorState.jobTitle.trim()),
        bio: sanitizeInput(authorState.bio.trim()),
        avatar: authorState.avatar.trim(),
        email: authorState.email.trim(),
        city: sanitizeInput(authorState.city.trim()),
        postal_code: sanitizeInput(authorState.postalCode.trim()),
        country: sanitizeInput(authorState.country.trim()),
        site_url: authorState.siteUrl.trim()
      };

      if (authorState.id) {
        const {data, error} = await supabase
          .from('db_profiles')
          .update(payload)
          .eq('id', authorState.id)
          .select();
        if (error) throw error;

        if (!data || data.length === 0) {
          const {data: existingRows} = await supabase
            .from('db_profiles')
            .select('id')
            .limit(1);
          if (existingRows && existingRows.length > 0) {
            const realId = existingRows[0].id;
            authorState.id = realId;
            const {data: updated2, error: err2} = await supabase
              .from('db_profiles')
              .update(payload)
              .eq('id', realId)
              .select();
            if (err2) throw err2;
            if (!updated2 || updated2.length === 0) {
              throw new Error('Could not update author profile record.');
            }
          } else {
            const {data: inserted, error: err3} = await supabase
              .from('db_profiles')
              .insert(payload)
              .select()
              .single();
            if (err3) throw err3;
            if (inserted) authorState.id = inserted.id;
          }
        }
      } else {
        const {data: existingRows} = await supabase
          .from('db_profiles')
          .select('id')
          .limit(1);
        if (existingRows && existingRows.length > 0) {
          const realId = existingRows[0].id;
          authorState.id = realId;
          const {data: updated, error: err4} = await supabase
            .from('db_profiles')
            .update(payload)
            .eq('id', realId)
            .select();
          if (err4) throw err4;
        } else {
          const {data: inserted, error: err5} = await supabase
            .from('db_profiles')
            .insert(payload)
            .select()
            .single();
          if (err5) throw err5;
          if (inserted) authorState.id = inserted.id;
        }
      }

      authorState.username = cleanUsername;
      authorSaveSuccess = true;
      authorInitial = {...authorState};
      setTimeout(() => (authorSaveSuccess = false), 2500);
      toastStore.success('Author profile saved.');
    } catch (err: any) {
      console.error('Error saving author profile:', err);
      authorSaveError = err.message || 'Failed to save author profile.';
      toastStore.error(authorSaveError);
    } finally {
      isSavingAuthor = false;
    }
  }

  function confirmClearAuthor() {
    if (!authorState.id) return;
    showClearAuthorDialog = true;
  }

  async function executeClearAuthor() {
    showClearAuthorDialog = false;
    isClearingAuthor = true;
    try {
      const {
        data: {user},
        error: userError
      } = await supabase.auth.getUser();
      if (userError || !user) {
        throw new Error('Your admin session has expired. Please log in again.');
      }

      if (authorState.id) {
        const {error} = await supabase
          .from('db_profiles')
          .delete()
          .eq('id', authorState.id);
        if (error) throw error;
      } else {
        const {error} = await supabase
          .from('db_profiles')
          .delete()
          .neq('id', '00000000-0000-0000-0000-000000000000');
        if (error) throw error;
      }

      authorState = {
        id: '',
        name: '',
        username: '',
        headline: '',
        jobTitle: '',
        bio: '',
        avatar: '',
        email: '',
        city: '',
        postalCode: '',
        country: '',
        siteUrl: ''
      };
      authorInitial = {...authorState};
      toastStore.success('Author profile cleared.');
    } catch (err: any) {
      console.error('Failed to clear author profile:', err);
      toastStore.error(err?.message || 'Failed to clear author profile.');
    } finally {
      isClearingAuthor = false;
    }
  }

  async function getAuthorId(): Promise<string | null> {
    if (authorState.id) return authorState.id;
    try {
      const {data} = await supabase
        .from('db_profiles')
        .select('id')
        .limit(1)
        .maybeSingle();
      if (data?.id) {
        authorState.id = data.id;
        return data.id;
      }

      const {data: created, error} = await supabase
        .from('db_profiles')
        .insert({
          name: authorState.name ? authorState.name.trim() : '',
          username: authorState.username ? authorState.username.trim() : '',
          headline: authorState.headline ? authorState.headline.trim() : '',
          job_title: authorState.jobTitle ? authorState.jobTitle.trim() : '',
          bio: authorState.bio ? authorState.bio.trim() : '',
          avatar: authorState.avatar ? authorState.avatar.trim() : '',
          email: authorState.email ? authorState.email.trim() : '',
          city: authorState.city ? authorState.city.trim() : '',
          postal_code:
            authorState.postalCode ? authorState.postalCode.trim() : '',
          country: authorState.country ? authorState.country.trim() : '',
          site_url: authorState.siteUrl ? authorState.siteUrl.trim() : ''
        })
        .select('id')
        .maybeSingle();

      if (created?.id) {
        authorState.id = created.id;
        return created.id;
      }
    } catch (err) {
      console.error('Error fetching or creating author_id:', err);
    }
    return null;
  }

  async function handleSaveCv(e: SubmitEvent) {
    e.preventDefault();
    if (isSavingCv) return;
    const experienceOk = validateAllExperience();
    const educationOk = validateAllEducation();
    if (!experienceOk || !educationOk) {
      toastStore.error('Please fix the errors below before saving.');
      return;
    }
    isSavingCv = true;
    cvSaveSuccess = false;
    try {
      const authorId = await getAuthorId();
      if (!authorId) throw new Error('Could not resolve author ID.');

      const experiences = cvState.experience.map((item, idx) => ({
        title: sanitizeInput(item.title.trim()),
        type: item.type || '',
        company: sanitizeInput(item.company.trim()),
        start_month: item.startMonth || '',
        start_year: item.startYear || currentYear,
        end_month: item.currentlyIn ? null : item.endMonth || null,
        end_year: item.currentlyIn ? null : item.endYear || null,
        currently_in: item.currentlyIn || false,
        location: sanitizeInput((item.location || '').trim()),
        loc_type: item.locType || '',
        description: sanitizeInput(item.description.trim()),
        sort_order: idx + 1
      }));

      const education = cvState.education.map((item, idx) => ({
        institution: sanitizeInput(item.institution.trim()),
        degree: sanitizeInput(item.degree.trim()),
        field: sanitizeInput(item.field.trim()),
        start_month: item.startMonth || 'September',
        start_year: item.startYear || currentYear,
        end_month: item.currentlyIn ? null : item.endMonth || null,
        end_year: item.currentlyIn ? null : item.endYear || null,
        currently_in: item.currentlyIn || false,
        grade: sanitizeInput(item.grade.trim()),
        description: sanitizeInput(item.description.trim()),
        sort_order: idx + 1
      }));

      const {error} = await supabase.rpc('db_save_cv', {
        p_author_id: authorId,
        p_experiences: experiences,
        p_education: education
      });
      if (error) throw error;

      cvInitial = $state.snapshot(cvState);
      cvSaveSuccess = true;
      setTimeout(() => (cvSaveSuccess = false), 2500);
      toastStore.success('CV entries saved.');
      executeGenerateCvPdf('patch');
    } catch (err: any) {
      console.error('Error saving CV entries:', err);
      const msg = err?.message || err?.error || 'Failed to save CV entries.';
      toastStore.error(msg);
    } finally {
      isSavingCv = false;
    }
  }

  async function handleSaveSkills(e: SubmitEvent) {
    e.preventDefault();
    if (isSavingSkills) return;
    if (!validateAllSkills()) {
      toastStore.error('Please fix the errors below before saving.');
      return;
    }
    isSavingSkills = true;
    skillsSaveSuccess = false;
    try {
      const authorId = await getAuthorId();
      if (!authorId) throw new Error('Could not resolve author ID.');

      const categories = skillsState.map((item, idx) => ({
        category: sanitizeInput(item.category.trim()),
        sort_order: idx + 1,
        skills:
          Array.isArray(item.skills) ?
            item.skills.map(s => sanitizeInput(s.trim())).filter(Boolean)
          : []
      }));

      const {error} = await supabase.rpc('db_save_skills', {
        p_author_id: authorId,
        p_categories: categories
      });
      if (error) throw error;

      skillsInitial = $state.snapshot(skillsState);
      skillsSaveSuccess = true;
      setTimeout(() => (skillsSaveSuccess = false), 2500);
      toastStore.success('Skills saved.');
    } catch (err: any) {
      console.error('Error saving skills:', err);
      const msg = err?.message || err?.error || 'Failed to save skills.';
      toastStore.error(msg);
    } finally {
      isSavingSkills = false;
    }
  }

  async function handleSaveSocials(e: SubmitEvent) {
    e.preventDefault();
    if (isSavingSocials) return;
    if (!validateAllSocials()) {
      toastStore.error('Please fix the errors below before saving.');
      return;
    }
    isSavingSocials = true;
    socialsSaveSuccess = false;
    try {
      const authorId = await getAuthorId();
      if (!authorId) throw new Error('Could not resolve author ID.');

      const items = socialState.map((item, idx) => ({
        platform: sanitizeInput(item.platform.trim()),
        display_value: null,
        url: item.url.trim(),
        icon: '',
        sort_order: idx + 1
      }));

      const {error} = await supabase.rpc('db_save_links', {
        p_author_id: authorId,
        p_category: 'social',
        p_items: items
      });
      if (error) throw error;

      socialInitial = $state.snapshot(socialState);
      socialsSaveSuccess = true;
      setTimeout(() => (socialsSaveSuccess = false), 2500);
      toastStore.success('Social links saved.');
    } catch (err: any) {
      console.error('Error saving socials:', err);
      const msg = err?.message || err?.error || 'Failed to save social links.';
      toastStore.error(msg);
    } finally {
      isSavingSocials = false;
    }
  }

  async function handleSaveSponsorship(e: SubmitEvent) {
    e.preventDefault();
    if (isSavingSponsorship) return;
    if (!validateAllSponsorship()) {
      toastStore.error('Please fix the errors below before saving.');
      return;
    }
    isSavingSponsorship = true;
    sponsorshipSaveSuccess = false;
    try {
      const authorId = await getAuthorId();
      if (!authorId) throw new Error('Could not resolve author ID.');

      const items = sponsorshipState.map((item, idx) => ({
        platform: sanitizeInput(item.platform.trim()),
        display_value: sanitizeInput(item.displayValue.trim()),
        url: item.url.trim(),
        icon: '',
        sort_order: idx + 1
      }));

      const {error} = await supabase.rpc('db_save_links', {
        p_author_id: authorId,
        p_category: 'funding',
        p_items: items
      });
      if (error) throw error;

      sponsorshipInitial = $state.snapshot(sponsorshipState);
      sponsorshipSaveSuccess = true;
      setTimeout(() => (sponsorshipSaveSuccess = false), 2500);
      toastStore.success('Sponsorship links saved.');
    } catch (err: any) {
      console.error('Error saving sponsorship links:', err);
      const msg =
        err?.message || err?.error || 'Failed to save sponsorship links.';
      toastStore.error(msg);
    } finally {
      isSavingSponsorship = false;
    }
  }

  async function handleSaveContact(e: SubmitEvent) {
    e.preventDefault();
    if (isSavingContact) return;
    if (!validateAllContact()) {
      toastStore.error('Please fix the errors below before saving.');
      return;
    }
    isSavingContact = true;
    contactSaveSuccess = false;
    try {
      const authorId = await getAuthorId();
      if (!authorId) throw new Error('Could not resolve author ID.');

      const items = contactState.map((item, idx) => ({
        platform: sanitizeInput(item.platform.trim()),
        display_value: sanitizeInput(item.displayValue.trim()),
        url: item.href.trim(),
        icon: '',
        sort_order: idx + 1
      }));

      const {error} = await supabase.rpc('db_save_links', {
        p_author_id: authorId,
        p_category: 'contact',
        p_items: items
      });
      if (error) throw error;

      contactInitial = $state.snapshot(contactState);
      contactSaveSuccess = true;
      setTimeout(() => (contactSaveSuccess = false), 2500);
      toastStore.success('Contact info saved.');
    } catch (err: any) {
      console.error('Error saving contact info:', err);
      const msg = err?.message || err?.error || 'Failed to save contact info.';
      toastStore.error(msg);
    } finally {
      isSavingContact = false;
    }
  }

  async function executeGenerateCvPdf(
    bumpType: 'patch' | 'minor' | 'major' = 'patch'
  ) {
    isGeneratingPdf = true;
    pdfUploadError = '';
    pdfUploadSuccess = '';

    try {
      const {
        data: {user},
        error: userError
      } = await supabase.auth.getUser();
      if (userError || !user) {
        throw new Error('Your admin session has expired. Please log in again.');
      }

      const {data: sessionData} = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;
      if (!accessToken) {
        throw new Error('Your admin session has expired. Please log in again.');
      }

      const response = await fetch('/api/internal/admin/cv/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`
        },
        body: JSON.stringify({bumpType})
      });

      const res = await response.json();
      if (!response.ok || !res.success) {
        const errorMsg =
          typeof res?.message === 'string' ? res.message
          : typeof res?.error?.message === 'string' ? res.error.message
          : typeof res?.error === 'string' ? res.error
          : 'Failed to generate CV PDF';
        throw new Error(errorMsg);
      }

      cvDocState = {
        filename: res.filename,
        fileUrl: res.fileUrl,
        hash: res.hash,
        isActive: true
      };

      const provider = res.storageProvider || 'R2';
      pdfUploadSuccess = `Successfully generated ${res.filename} (v${res.version}) & synced to ${provider}!`;
      toastStore.success(`CV PDF generated (v${res.version})`);
    } catch (err: any) {
      console.error('PDF generation error:', err);
      pdfUploadError =
        typeof err?.message === 'string' ? err.message
        : typeof err === 'string' ? err
        : 'Failed to generate CV PDF';
      toastStore.error(pdfUploadError);
    } finally {
      isGeneratingPdf = false;
    }
  }

  function confirmDeleteCvDoc() {
    if (!cvDocState.filename) return;
    showDeleteCvDocDialog = true;
  }

  async function executeDeleteCvDoc() {
    showDeleteCvDocDialog = false;
    try {
      const {
        data: {user},
        error: userError
      } = await supabase.auth.getUser();
      if (userError || !user) {
        throw new Error('Your admin session has expired. Please log in again.');
      }
      const {data: sessionData} = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;
      if (!accessToken) {
        throw new Error('Your admin session has expired. Please log in again.');
      }

      const response = await fetch('/api/internal/admin/cv/delete', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`
        },
        body: JSON.stringify({filename: cvDocState.filename})
      });

      const result = await response.json().catch(() => ({}));

      if (response.ok) {
        cvDocState = {filename: '', fileUrl: '', hash: '', isActive: false};
        pdfUploadSuccess = 'CV document deleted successfully.';
        setTimeout(() => (pdfUploadSuccess = ''), 3000);
        toastStore.success('CV document deleted.');
      } else {
        const errMsg =
          typeof result?.message === 'string' ? result.message
          : typeof result?.error?.message === 'string' ? result.error.message
          : typeof result?.error === 'string' ? result.error
          : 'Failed to delete CV document.';
        toastStore.error(errMsg);
      }
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Failed to delete CV document.';
      console.error('Failed to delete CV document:', err);
      toastStore.error(message);
    }
  }

  function handleAddCvEntry(type: 'experience' | 'education') {
    if (type === 'experience') {
      cvState.experience = [
        ...cvState.experience,
        {
          title: '',
          type: '',
          company: '',
          startMonth: '',
          startYear: null,
          endMonth: null,
          endYear: null,
          currentlyIn: false,
          location: '',
          locType: '',
          description: ''
        }
      ];
    } else {
      cvState.education = [
        ...cvState.education,
        {
          institution: '',
          degree: '',
          field: '',
          startMonth: '',
          startYear: null,
          endMonth: null,
          endYear: null,
          currentlyIn: false,
          grade: '',
          description: ''
        }
      ];
    }
  }

  type RemovableEntry =
    | 'cv-experience'
    | 'cv-education'
    | 'skill'
    | 'social'
    | 'sponsorship'
    | 'contact';
  let showRemoveEntryDialog = $state(false);
  let pendingRemove = $state<{type: RemovableEntry; idx: number} | null>(null);

  const removeEntryLabels: Record<RemovableEntry, string> = {
    'cv-experience': 'this experience entry',
    'cv-education': 'this education entry',
    skill: 'this skill category',
    social: 'this social link',
    sponsorship: 'this sponsorship link',
    contact: 'this contact'
  };
  const removeEntryMessage = $derived(
    pendingRemove ?
      `Are you sure you want to remove ${removeEntryLabels[pendingRemove.type]}? This won't be saved until you click Save.`
    : ''
  );

  function confirmRemoveCvEntry(type: 'experience' | 'education', idx: number) {
    pendingRemove = {
      type: type === 'experience' ? 'cv-experience' : 'cv-education',
      idx
    };
    showRemoveEntryDialog = true;
  }

  function confirmRemoveSkill(idx: number) {
    pendingRemove = {type: 'skill', idx};
    showRemoveEntryDialog = true;
  }

  function confirmRemoveSocial(idx: number) {
    pendingRemove = {type: 'social', idx};
    showRemoveEntryDialog = true;
  }

  function confirmRemoveSponsorship(idx: number) {
    pendingRemove = {type: 'sponsorship', idx};
    showRemoveEntryDialog = true;
  }

  function confirmRemoveContact(idx: number) {
    pendingRemove = {type: 'contact', idx};
    showRemoveEntryDialog = true;
  }

  function executeRemoveEntry() {
    if (!pendingRemove) return;
    const {type, idx} = pendingRemove;
    if (type === 'cv-experience') {
      cvState.experience = cvState.experience.filter((_, i) => i !== idx);
    } else if (type === 'cv-education') {
      cvState.education = cvState.education.filter((_, i) => i !== idx);
    } else if (type === 'skill') {
      skillsState = skillsState.filter((_, i) => i !== idx);
    } else if (type === 'social') {
      socialState = socialState.filter((_, i) => i !== idx);
    } else if (type === 'sponsorship') {
      sponsorshipState = sponsorshipState.filter((_, i) => i !== idx);
    } else if (type === 'contact') {
      contactState = contactState.filter((_, i) => i !== idx);
    }
    pendingRemove = null;
    showRemoveEntryDialog = false;
  }

  function handleAddSkill() {
    skillsState = [...skillsState, {category: '', skills: []}];
  }

  function handleAddSocial() {
    socialState = [...socialState, {platform: '', url: '', icon: ''}];
  }

  function handleAddSponsorship() {
    sponsorshipState = [
      ...sponsorshipState,
      {platform: '', displayValue: '', url: '', icon: '', description: ''}
    ];
  }

  function handleAddContact() {
    contactState = [
      ...contactState,
      {platform: '', displayValue: '', href: '', icon: ''}
    ];
  }

  const adminNavLinks: {
    id: typeof activeAdminTab;
    label: string;
    icon: any;
    section: 'content' | 'profile' | 'legal';
  }[] = [
    {id: 'posts', label: 'Posts', icon: FileText, section: 'content'},
    {id: 'profile', label: 'Profile', icon: User, section: 'profile'},
    {id: 'resume', label: 'Resume', icon: FileUser, section: 'profile'},
    {id: 'skills', label: 'Skills', icon: Layers, section: 'profile'},
    {id: 'socials', label: 'Social Links', icon: Share2, section: 'profile'},
    {id: 'sponsorship', label: 'Sponsorship', icon: Heart, section: 'profile'},
    {id: 'contact', label: 'Contact', icon: Mail, section: 'profile'},
    {id: 'privacy', label: 'Privacy Policy', icon: Lock, section: 'legal'},
    {
      id: 'security',
      label: 'Security Policy',
      icon: ShieldCheck,
      section: 'legal'
    },
    {id: 'terms', label: 'Terms of Service', icon: ScrollText, section: 'legal'}
  ];
</script>

<svelte:head>
  <title>Admin Console</title>
  <link
    rel="stylesheet"
    href="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/styles/{hljsTheme}.min.css" />
</svelte:head>

<SkipLink />

<Dialog
  isOpen={showSessionTimeoutDialog}
  onClose={() => {}}
  title="Session Timeout Warning"
  class="max-w-md">
  <div class="flex flex-col gap-6 py-2">
    <p class="text-sm text-text-secondary">
      Your admin session is about to expire due to inactivity. Would you like to
      extend your session or log out?
    </p>

    <div class="flex items-center justify-between gap-4">
      <div class="relative flex h-16 w-16 shrink-0 items-center justify-center">
        <svg
          class="h-16 w-16 -rotate-90 transform"
          viewBox="0 0 48 48">
          <circle
            cx="24"
            cy="24"
            r="20"
            fill="none"
            class="stroke-copilot-subtle"
            stroke-width="4" />

          <circle
            cx="24"
            cy="24"
            r="20"
            fill="none"
            class="stroke-copilot transition-all duration-1000 ease-linear"
            stroke-width="4"
            stroke-linecap="round"
            stroke-dasharray="125.66"
            stroke-dashoffset={125.66 * (1 - countdownSeconds / 30)} />
        </svg>
        <span class="absolute font-mono text-sm font-bold text-copilot">
          {countdownSeconds}s
        </span>
      </div>

      <div class="flex items-center gap-3">
        <Button
          htmlType="button"
          type="danger"
          tone="critical"
          size="md"
          onclick={handleLogout}
          disabled={isLoggingOut}>
          Sign out
        </Button>
        <Button
          htmlType="button"
          type="primary"
          size="md"
          onclick={handleExtendSession}>
          Extend session
        </Button>
      </div>
    </div>
  </div>
</Dialog>

<div
  class="fixed top-0 z-40 flex h-14 w-full items-center justify-between border-b border-border-subtle bg-surface-card px-4 md:hidden">
  <div class="flex items-center gap-2">
    <IconButton
      onclick={() => (sidebarMobileOpen = !sidebarMobileOpen)}
      aria-expanded={sidebarMobileOpen}
      ariaLabel={sidebarMobileOpen ? 'Close sidebar' : 'Open sidebar'}>
      {#if sidebarMobileOpen}
        <X class="size-5" />
      {:else}
        <Menu class="size-5" />
      {/if}
    </IconButton>
    <span class="text-base font-bold text-text-primary">Admin Console</span>
  </div>
  <ThemeSelect
    theme={themeStore.current}
    onThemeChange={themeStore.apply} />
</div>

<div class="flex min-h-screen pt-14 md:pt-0">
  <aside
    class="fixed inset-y-0 left-0 z-50 flex w-56 shrink-0 flex-col justify-between overflow-y-auto border-r border-border-subtle bg-surface-card transition-transform duration-200 ease-in-out md:sticky md:top-0 md:h-screen md:w-56 md:translate-x-0 {(
      sidebarMobileOpen
    ) ?
      'translate-x-0 shadow-2xl'
    : '-translate-x-full'}">
    <div
      class="flex items-center justify-between border-b border-border-subtle px-3.5 py-2.5">
      <h1 class="text-xs font-bold tracking-tight text-text-primary">
        Admin Console
      </h1>
      <ThemeSelect
        theme={themeStore.current}
        onThemeChange={themeStore.apply} />
    </div>

    <nav
      class="flex flex-1 flex-col px-2.5 py-2 font-sans"
      aria-label="Admin Navigation">
      <div
        class="px-2 py-1 text-[10px] font-bold tracking-wider text-text-muted uppercase select-none">
        Content Management
      </div>
      <div class="flex flex-col gap-0.5">
        {#each adminNavLinks.filter(l => l.section === 'content') as link (link.id)}
          <button
            type="button"
            onclick={() => selectTab(link.id)}
            class="group flex h-8 w-full items-center gap-2.5 rounded-sm px-2.5 text-left text-xs font-semibold transition-all duration-150 ease-in-out {(
              activeAdminTab === link.id
            ) ?
              'border-l-2 border-copilot bg-copilot-subtle font-bold text-copilot shadow-2xs'
            : 'border-l-2 border-transparent text-text-primary hover:bg-surface-hover hover:text-copilot'}">
            <link.icon class="size-4 shrink-0 transition-colors" />
            <span class="truncate">{link.label}</span>
          </button>
        {/each}
      </div>

      <div
        class="mt-3 border-t border-border-subtle/30 px-2 pt-2.5 pb-1 text-[10px] font-bold tracking-wider text-text-muted uppercase select-none">
        Profile & Resume
      </div>
      <div class="flex flex-col gap-0.5">
        {#each adminNavLinks.filter(l => l.section === 'profile') as link (link.id)}
          <button
            type="button"
            onclick={() => selectTab(link.id)}
            class="group flex h-8 w-full items-center gap-2.5 rounded-sm px-2.5 text-left text-xs font-semibold transition-all duration-150 ease-in-out {(
              activeAdminTab === link.id
            ) ?
              'border-l-2 border-copilot bg-copilot-subtle font-bold text-copilot shadow-2xs'
            : 'border-l-2 border-transparent text-text-primary hover:bg-surface-hover hover:text-copilot'}">
            <link.icon class="size-4 shrink-0 transition-colors" />
            <span class="truncate">{link.label}</span>
          </button>
        {/each}
      </div>

      <div
        class="mt-3 border-t border-border-subtle/30 px-2 pt-2.5 pb-1 text-[10px] font-bold tracking-wider text-text-muted uppercase select-none">
        Legal & Policy
      </div>
      <div class="flex flex-col gap-0.5">
        {#each adminNavLinks.filter(l => l.section === 'legal') as link (link.id)}
          <button
            type="button"
            onclick={() => selectTab(link.id)}
            class="group flex h-8 w-full items-center gap-2.5 rounded-sm px-2.5 text-left text-xs font-semibold transition-all duration-150 ease-in-out {(
              activeAdminTab === link.id
            ) ?
              'border-l-2 border-copilot bg-copilot-subtle font-bold text-copilot shadow-2xs'
            : 'border-l-2 border-transparent text-text-primary hover:bg-surface-hover hover:text-copilot'}">
            <link.icon class="size-4 shrink-0 transition-colors" />
            <span class="truncate">{link.label}</span>
          </button>
        {/each}
      </div>
    </nav>

    <div
      class="sticky bottom-0 z-10 mt-auto border-t border-border-subtle bg-surface-card px-3 py-2.5">
      <div class="flex items-center justify-between gap-2">
        <div class="flex min-w-0 items-center gap-2">
          {#if authorState.avatar}
            <ImageWithSkeleton
              src={authorState.avatar}
              alt={authorState.name || 'Admin'}
              referrerpolicy="no-referrer"
              rounded="rounded-full"
              class="h-7 w-7 shrink-0 border border-border-subtle"
              imgClass="object-top" />
          {:else}
            <User class="size-5 shrink-0 text-text-muted" />
          {/if}
          <div class="flex flex-col truncate">
            {#if isLoading || (!authorState.name && !adminUserEmail)}
              <div
                class="h-3 w-20 animate-pulse rounded bg-surface-hover"
                aria-hidden="true">
              </div>
              <div
                class="mt-1 h-2 w-24 animate-pulse rounded bg-border-default"
                aria-hidden="true">
              </div>
            {:else}
              <span class="text-xs leading-tight font-bold text-text-primary"
                >{authorState.name || ''}</span>
              <span
                class="truncate font-mono text-[10.5px] leading-tight font-normal text-text-muted"
                title={adminUserEmail || authorState.email}>
                {adminUserEmail || authorState.email || ''}
              </span>
            {/if}
          </div>
        </div>

        <Button
          type="secondary"
          size="sm"
          onclick={handleLogout}
          disabled={isLoggingOut}
          isLoading={isLoggingOut}
          title="Sign out">
          Sign out
        </Button>
      </div>
    </div>
  </aside>

  {#if sidebarMobileOpen}
    <button
      type="button"
      class="fixed inset-0 z-40 bg-overlay md:hidden"
      onclick={() => (sidebarMobileOpen = false)}
      aria-label="Close sidebar"></button>
  {/if}

  <main
    id="main-content"
    class="flex-1 overflow-y-auto p-4 pb-24 font-sans sm:p-6 md:h-screen {(
      ['privacy', 'security', 'terms'].includes(activeAdminTab)
    ) ?
      'pt-0! pb-0!'
    : ''}">
    {#if isLoading}
      <LoadingState
        label="Loading dashboard..."
        size="lg"
        class="py-20" />
    {:else if activeAdminTab === 'posts'}
      <div class="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 class="text-2xl font-bold tracking-tight text-text-primary">
            Posts
          </h1>
          <p class="mt-1 text-xs text-text-secondary">
            Manage articles and post comments
          </p>
        </div>

        <Button
          href="/admin/new"
          type="primary"
          size="md">
          {#snippet leading()}
            <Plus class="size-3.5" />
          {/snippet}
          New Post
        </Button>
      </div>

      <FilterToolbar
        title="Posts filter"
        class="mb-6">
        {#snippet searchSlot()}
          <Input
            type="search"
            placeholder="Search posts..."
            value={filterStore.search}
            oninput={e =>
              filterStore.setSearch((e.target as HTMLInputElement).value)}
            size="sm"
            aria-label="Search blog posts" />
        {/snippet}
        {#snippet countSlot()}
          <SearchResultCount
            count={filteredPosts.length}
            total={posts.length}
            itemLabel="posts" />
        {/snippet}
        {#snippet filterControlsSlot()}
          <FilterSelect
            label="Status"
            value={statusFilter}
            options={[
              {value: 'all', label: 'All Status'},
              {value: 'published', label: 'Published'},
              {value: 'draft', label: 'Draft'}
            ]}
            onChange={val => filterStore.setSingleFilter('status', val)} />
          {#if allPostTags.length > 0}
            <FilterCheckboxGroup
              label="Tag"
              options={allPostTags.map(t => ({value: t, label: t}))}
              selectedValues={filterStore.filters['tag'] || []}
              onChange={val => filterStore.toggleMultiFilter('tag', val)} />
          {/if}
        {/snippet}
        {#snippet sortSlot()}
          <SortControl
            currentField={filterStore.sort.field}
            currentDirection={filterStore.sort.direction}
            fields={[
              {value: 'date', label: 'Date'},
              {value: 'title', label: 'Title'},
              {value: 'status', label: 'Status'},
              {value: 'views', label: 'Views'},
              {value: 'comments', label: 'Comments'}
            ]}
            onFieldChange={val =>
              filterStore.setSort(val, filterStore.sort.direction)}
            onDirectionToggle={() =>
              filterStore.setSort(
                filterStore.sort.field,
                filterStore.sort.direction === 'asc' ? 'desc' : 'asc'
              )} />
        {/snippet}
      </FilterToolbar>

      <FilterChipGroup
        chips={filterStore.activeChips}
        onRemove={filterStore.removeFilter}
        onClearAll={filterStore.clearAllFilters}
        class="mb-6" />

      {#if filteredPosts.length === 0}
        {#if filterStore.isFiltered}
          <FilterEmptyState onClearFilters={filterStore.clearAllFilters} />
        {:else}
          <EmptyState
            title="No posts found"
            description="Try adjusting your filter or search query." />
        {/if}
      {:else}
        <div class="grid grid-cols-1 items-start gap-4 md:grid-cols-2">
          {#each paginatedPosts as post (post.id)}
            <Card class="relative flex h-full w-full flex-col gap-3">
              {#if post.banner_path && !failedBanners.has(post.id)}
                <ImageWithSkeleton
                  src={getBannerUrl(post.banner_path)}
                  alt={post.title}
                  aspectRatio="aspect-video"
                  onerror={() => markBannerFailed(post.id)}
                  class="w-full border border-border-subtle" />
              {:else}
                <div
                  class="relative flex aspect-video w-full items-center justify-center overflow-hidden rounded-sm border border-border-subtle bg-linear-to-br from-accent/15 to-copilot/15 select-none">
                  <ImageIcon class="size-8 text-copilot/50" />
                </div>
              {/if}

              <div
                class="flex w-full scrollbar-none flex-wrap items-center gap-x-2 gap-y-1 text-xs font-semibold text-text-secondary select-none [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
                <Badge variant={post.published ? 'success' : 'warning'}>
                  {post.published ? 'Published' : 'Draft'}
                </Badge>
                <span aria-hidden="true">&middot;</span>
                <RelativeTime date={post.created_at} />
                <span aria-hidden="true">&middot;</span>
                <span
                  >Last updated {formatAbsoluteDate(
                    post.updated_at || post.created_at
                  )}</span>
                <span aria-hidden="true">&middot;</span>
                <span>{formatReadTime(post.read_time)}</span>
                <span aria-hidden="true">&middot;</span>
                <span>{formatViewCount(postViewsMap.get(post.id) ?? 0)}</span>
              </div>

              <div>
                <h3
                  class="text-base leading-snug font-bold text-text-primary transition-colors hover:text-copilot">
                  <a
                    href={`/blog/${post.slug}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    class="rounded-xs outline-none hover:underline focus-visible:ring-2 focus-visible:ring-copilot">
                    {post.title}
                  </a>
                </h3>
              </div>

              {#if post.tags && post.tags.length > 0}
                <div class="flex min-h-[24px] flex-wrap items-start gap-1.5">
                  {#each post.tags as tag (tag)}
                    {@const cleanTag = decodeHtmlEntities(tag)}
                    <button
                      type="button"
                      onclick={() => filterStore.toggleMultiFilter('tag', tag)}
                      class="cursor-pointer rounded-md bg-border-subtle/30 px-1.5 py-0.5 font-mono text-[12px] font-medium transition-colors hover:bg-surface-hover hover:text-copilot {(
                        filterStore.filters['tag']?.includes(tag)
                      ) ?
                        'font-semibold text-copilot'
                      : 'text-text-muted'}">
                      {cleanTag}
                    </button>
                  {/each}
                </div>
              {/if}

              {#if post.excerpt}
                <p
                  class="min-h-16 text-xs leading-relaxed font-normal text-text-primary">
                  {post.excerpt}
                </p>
              {/if}

              <div
                class="mt-auto flex w-full scrollbar-none flex-wrap items-center justify-between gap-2 overflow-x-auto border-t border-border-subtle/40 pt-3.5 whitespace-nowrap [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
                <div
                  class="flex w-full flex-wrap items-center justify-between gap-2 sm:w-auto sm:justify-start">
                  <Button
                    htmlType="button"
                    type="primary"
                    size="sm"
                    onclick={() =>
                      (window.location.href = `/admin/new?id=${post.id}`)}>
                    Edit
                  </Button>

                  <Button
                    htmlType="button"
                    type="secondary"
                    size="sm"
                    aria-expanded={expandedPostIds.has(post.id)}
                    aria-controls="comments-{post.id}"
                    onclick={() => toggleComments(post.id)}>
                    {expandedPostIds.has(post.id) ? 'Hide' : 'Show'} comments ({getPostComments(
                      post.id
                    ).length})
                  </Button>

                  <Button
                    htmlType="button"
                    type="secondary"
                    size="sm"
                    onclick={() => handleTogglePublished(post)}>
                    {post.published ? 'Unpublish' : 'Publish'}
                  </Button>
                </div>

                <div class="flex w-full items-center gap-2 sm:w-auto">
                  <Button
                    htmlType="button"
                    type="danger"
                    tone="critical"
                    size="sm"
                    class="w-full sm:w-auto"
                    onclick={() => confirmDeletePost(post)}>
                    Delete
                  </Button>
                </div>
              </div>

              {#if expandedPostIds.has(post.id)}
                <div
                  id="comments-{post.id}"
                  class="mt-4 border-t border-border-subtle pt-4">
                  <h4 class="mb-3 text-xs font-bold text-text-secondary">
                    Comments ({getPostComments(post.id).length})
                  </h4>
                  {#if getPostComments(post.id).length === 0}
                    <p class="text-xs text-text-muted">No comments yet.</p>
                  {:else}
                    <CommentThread
                      comments={getPostComments(post.id)}
                      {replyTo}>
                      {#snippet statusBadge(comment)}
                        <Badge
                          variant={comment.is_approved ? 'success' : 'warning'}>
                          {comment.is_approved ? 'Approved' : 'Pending'}
                        </Badge>
                      {/snippet}

                      {#snippet actions(comment)}
                        <RelativeTime
                          date={comment.created_at}
                          tag="time" />
                        <span aria-hidden="true">&middot;</span>
                        <button
                          type="button"
                          onclick={() => toggleCommentApproval(comment)}
                          class="cursor-pointer font-bold text-text-muted transition-colors hover:text-copilot focus-visible:outline-none">
                          {comment.is_approved ? 'Unapprove' : 'Approve'}
                        </button>
                        <span aria-hidden="true">&middot;</span>
                        <button
                          type="button"
                          onclick={() => {
                            replyTo = comment;
                            commentContent = '';
                          }}
                          class="cursor-pointer font-bold text-text-muted transition-colors hover:text-copilot focus-visible:outline-none">
                          Reply
                        </button>
                        <span aria-hidden="true">&middot;</span>
                        <button
                          type="button"
                          onclick={() => confirmDeleteComment(comment.id)}
                          class="cursor-pointer font-bold text-danger transition-colors hover:underline focus-visible:outline-none">
                          Delete
                        </button>
                      {/snippet}

                      {#snippet replyForm(comment)}
                        <form
                          novalidate
                          onsubmit={e =>
                            handleAdminSubmit(e, comment.id, comment.post_id)}
                          class="rounded-sm border border-border-subtle bg-surface-card p-4">
                          <div
                            class="mb-3 flex items-center justify-between gap-3">
                            <p
                              class="text-xs font-semibold text-text-secondary">
                              Replying to {(
                                comment.is_anonymous || !comment.author_name
                              ) ?
                                'Anonymous'
                              : comment.author_name}
                            </p>
                            <Button
                              type="ghost"
                              size="sm"
                              onclick={() => (replyTo = null)}>Cancel</Button>
                          </div>

                          <FormField
                            id="admin-reply-msg-{comment.id}"
                            label="Admin Reply"
                            required>
                            <Textarea
                              id="admin-reply-msg-{comment.id}"
                              rows={3}
                              maxlength={1000}
                              placeholder="Write admin reply..."
                              bind:value={commentContent}
                              required />
                          </FormField>

                          <div class="mt-3 flex justify-end">
                            <Button
                              htmlType="submit"
                              type="primary"
                              size="sm"
                              disabled={isSubmitting}
                              isLoading={isSubmitting}>
                              {isSubmitting ? 'Posting...' : 'Post Admin Reply'}
                            </Button>
                          </div>
                        </form>
                      {/snippet}
                    </CommentThread>
                  {/if}
                </div>
              {/if}
            </Card>
          {/each}
        </div>
        <div class="mt-6">
          <Pagination
            page={postsPageClamped}
            totalPages={postsTotalPages}
            onPageChange={p => (postsPage = p)} />
        </div>
      {/if}
    {:else if activeAdminTab === 'profile'}
      <FormSection
        onsubmit={handleSaveAuthor}
        title="Profile"
        description="Manage your public author profile and contact details."
        titleClass="text-2xl font-bold tracking-tight text-text-primary"
        class="gap-8">
        {#if authorSaveError}<StatusBanner
            variant="error"
            message={authorSaveError} />{/if}
        {#if authorSaveSuccess}<StatusBanner
            variant="success"
            message="Profile saved successfully!" />{/if}

        <div class="flex flex-col gap-10">
          <section aria-labelledby="section-identity">
            <h3
              id="section-identity"
              class="mb-4 text-xxs font-bold tracking-widest text-text-secondary uppercase select-none">
              Identity
            </h3>
            <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <FormField
                id="author-name"
                label="Name"
                required
                counter={`${(authorState.name || '').length}/50`}
                error={authorErrors.name}
                valid={authorValid.name}>
                <Input
                  id="author-name"
                  bind:value={authorState.name}
                  placeholder="Ex: Linus Torvalds"
                  maxlength={50}
                  aria-required="true"
                  error={!!authorErrors.name}
                  valid={authorValid.name}
                  oninput={() => onAuthorInput('name')} />
              </FormField>

              <FormField
                id="author-username"
                label="Username"
                required
                counter={`${(authorState.username || '').length}/50`}
                error={authorErrors.username}
                valid={authorValid.username}>
                <Input
                  id="author-username"
                  bind:value={authorState.username}
                  placeholder="Ex: @torvalds"
                  maxlength={50}
                  aria-required="true"
                  error={!!authorErrors.username}
                  valid={authorValid.username}
                  oninput={() => onAuthorInput('username')} />
              </FormField>

              <FormField
                id="author-job"
                label="Job Title"
                required
                counter={`${(authorState.jobTitle || '').length}/50`}
                error={authorErrors.jobTitle}
                valid={authorValid.jobTitle}>
                <Input
                  id="author-job"
                  bind:value={authorState.jobTitle}
                  placeholder="Ex: Kernel Developer"
                  maxlength={50}
                  aria-required="true"
                  error={!!authorErrors.jobTitle}
                  valid={authorValid.jobTitle}
                  oninput={() => onAuthorInput('jobTitle')} />
              </FormField>

              <FormField
                id="author-headline"
                label="Headline"
                required
                counter={`${(authorState.headline || '').length}/100`}
                error={authorErrors.headline}
                valid={authorValid.headline}>
                <Input
                  id="author-headline"
                  bind:value={authorState.headline}
                  placeholder="Ex: Linux Kernel Core Developer/Maintainer"
                  maxlength={100}
                  aria-required="true"
                  error={!!authorErrors.headline}
                  valid={authorValid.headline}
                  oninput={() => onAuthorInput('headline')} />
              </FormField>
            </div>
          </section>

          <section aria-labelledby="section-contact">
            <h3
              id="section-contact"
              class="mb-4 text-xxs font-bold tracking-widest text-text-muted uppercase select-none">
              Contact
            </h3>
            <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <FormField
                id="author-avatar"
                label="Avatar Image URL"
                required
                counter={`${(authorState.avatar || '').length}/100`}
                error={authorErrors.avatar}
                valid={authorValid.avatar}>
                <div class="flex items-center gap-3">
                  <button
                    type="button"
                    class="group relative flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full border border-border-subtle bg-surface-base transition-transform select-none hover:scale-105 active:scale-95"
                    onclick={() => {
                      if (authorState.avatar) showAvatarPreviewDialog = true;
                    }}
                    aria-label="Preview avatar">
                    {#if authorState.avatar}
                      <div
                        class="absolute inset-0 z-0 flex items-center justify-center bg-surface-subtle">
                        <User class="size-5 text-text-muted" />
                      </div>
                      {#key authorState.avatar}
                        <img
                          src={authorState.avatar}
                          alt="Avatar preview"
                          class="absolute inset-0 z-10 h-full w-full object-cover"
                          onerror={e =>
                            ((
                              e.currentTarget as HTMLImageElement
                            ).style.display = 'none')}
                          onload={e =>
                            ((
                              e.currentTarget as HTMLImageElement
                            ).style.display = 'block')} />
                      {/key}
                      <div
                        class="absolute inset-0 z-20 flex items-center justify-center bg-black/40 opacity-0 transition-opacity group-hover:opacity-100">
                        <ZoomIn class="size-5 text-white" />
                      </div>
                    {:else}
                      <div
                        class="absolute inset-0 flex items-center justify-center bg-surface-subtle">
                        <User class="size-5 text-text-muted" />
                      </div>
                    {/if}
                  </button>
                  <Input
                    id="author-avatar"
                    bind:value={authorState.avatar}
                    placeholder="Ex: https://example.com/favicon.ico"
                    maxlength={100}
                    aria-required="true"
                    error={!!authorErrors.avatar}
                    valid={authorValid.avatar}
                    oninput={() => onAuthorInput('avatar')} />
                </div>
              </FormField>

              <FormField
                id="author-email"
                label="Email"
                required
                counter={`${(authorState.email || '').length}/50`}
                error={authorErrors.email}
                valid={authorValid.email}>
                <Input
                  id="author-email"
                  type="text"
                  bind:value={authorState.email}
                  placeholder="Ex: torvalds@linux-foundation.org"
                  maxlength={50}
                  aria-required="true"
                  error={!!authorErrors.email}
                  valid={authorValid.email}
                  oninput={() => onAuthorInput('email')} />
              </FormField>
            </div>
          </section>

          <section aria-labelledby="section-location">
            <h3
              id="section-location"
              class="mb-4 text-xxs font-bold tracking-widest text-text-secondary uppercase select-none">
              Location
            </h3>
            <div class="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <FormField
                id="author-city"
                label="City"
                required
                counter={`${(authorState.city || '').length}/50`}
                error={authorErrors.city}
                valid={authorValid.city}>
                <Input
                  id="author-city"
                  bind:value={authorState.city}
                  placeholder="Ex: Helsinki"
                  maxlength={50}
                  aria-required="true"
                  error={!!authorErrors.city}
                  valid={authorValid.city}
                  oninput={() => onAuthorInput('city')} />
              </FormField>

              <FormField
                id="author-postal"
                label="Postal Code"
                required
                counter={`${(authorState.postalCode || '').length}/10`}
                error={authorErrors.postalCode}
                valid={authorValid.postalCode}>
                <Input
                  id="author-postal"
                  bind:value={authorState.postalCode}
                  placeholder="Ex: 00100"
                  maxlength={10}
                  aria-required="true"
                  error={!!authorErrors.postalCode}
                  valid={authorValid.postalCode}
                  oninput={() => onAuthorInput('postalCode')} />
              </FormField>

              <FormField
                id="author-country"
                label="Country"
                required
                counter={`${(authorState.country || '').length}/50`}
                error={authorErrors.country}
                valid={authorValid.country}>
                <Input
                  id="author-country"
                  bind:value={authorState.country}
                  placeholder="Ex: Finland"
                  maxlength={50}
                  aria-required="true"
                  error={!!authorErrors.country}
                  valid={authorValid.country}
                  oninput={() => onAuthorInput('country')} />
              </FormField>
            </div>
          </section>

          <section aria-labelledby="section-about">
            <h3
              id="section-about"
              class="mb-4 text-xxs font-bold tracking-widest text-text-secondary uppercase select-none">
              About
            </h3>
            <div class="flex flex-col gap-4">
              <FormField
                id="author-site"
                label="Site URL"
                required
                counter={`${(authorState.siteUrl || '').length}/100`}
                error={authorErrors.siteUrl}
                valid={authorValid.siteUrl}>
                <Input
                  id="author-site"
                  bind:value={authorState.siteUrl}
                  placeholder="Ex: https://linux.org/"
                  maxlength={100}
                  aria-required="true"
                  error={!!authorErrors.siteUrl}
                  valid={authorValid.siteUrl}
                  oninput={() => onAuthorInput('siteUrl')} />
              </FormField>

              <FormField
                id="author-bio"
                label="Description"
                required
                counter={`${(authorState.bio || '').length}/1000`}
                error={authorErrors.bio}
                valid={authorValid.bio}>
                <Textarea
                  id="author-bio"
                  bind:value={authorState.bio}
                  placeholder="Describe anything about you..."
                  rows={4}
                  maxlength={1000}
                  aria-required="true"
                  error={!!authorErrors.bio}
                  valid={authorValid.bio}
                  oninput={() => onAuthorInput('bio')} />
              </FormField>
            </div>
          </section>
        </div>

        {#snippet actions()}
          <FormActions>
            {#if authorIsDirty}
              <p class="text-xs text-text-secondary select-none">
                You have unsaved changes.
              </p>
            {/if}
            <Button
              htmlType="button"
              type="danger"
              tone="critical"
              size="md"
              disabled={!authorState.id}
              onclick={confirmClearAuthor}
              isLoading={isClearingAuthor}>
              {#snippet leading()}
                <Trash2 class="size-3.5" />
              {/snippet}
              <span>Delete Profile</span>
            </Button>
            <Button
              htmlType="submit"
              type="primary"
              size="md"
              disabled={!authorIsDirty}
              isLoading={isSavingAuthor}>
              Save Profile
            </Button>
          </FormActions>
        {/snippet}
      </FormSection>
    {:else if activeAdminTab === 'resume'}
      <div class="mb-6">
        <h1 class="text-2xl font-bold tracking-tight text-text-primary">
          Resume
        </h1>
        <p class="mt-1 text-xs text-text-secondary">
          Manage work experience, education, and the CV document.
        </p>
      </div>

      <form
        onsubmit={handleSaveCv}
        novalidate
        class="flex flex-col gap-8">
        {#if cvSaveSuccess}
          <StatusBanner
            variant="success"
            message="Resume saved successfully!" />
        {/if}

        <Card>
          <div class="mb-6 flex items-center justify-between gap-4">
            <div>
              <h2 class="text-xl font-bold text-text-primary">Experiences</h2>
              <p class="mt-1 text-xs text-text-secondary">
                List your work history in reverse chronological order.
              </p>
            </div>
            <Button
              htmlType="button"
              type="primary"
              size="sm"
              onclick={() => handleAddCvEntry('experience')}>
              {#snippet leading()}
                <Plus class="size-3.5" />
              {/snippet}
              Add Experience
            </Button>
          </div>
          <div class="flex flex-col gap-6">
            {#if cvState.experience.length === 0}
              <EmptyState
                title="No experience entries yet"
                description="Add your first experience entry below." />
            {/if}
            {#each cvState.experience as exp, idx (exp.id ?? idx)}
              <div
                class="flex flex-col gap-4 rounded-sm border border-border-subtle bg-surface-card p-4">
                <div
                  class="flex items-center justify-between border-b border-border-subtle/40 pb-2">
                  <span class="font-mono text-xs font-light text-text-muted"
                    >Experience Entry #{idx + 1}</span>
                  <div class="flex items-center gap-1">
                    <Button
                      htmlType="button"
                      type="ghost"
                      size="sm"
                      aria-label="Move experience item up"
                      title="Move experience item up"
                      disabled={idx === 0}
                      onclick={() =>
                        (cvState.experience = moveArrayItem(
                          cvState.experience,
                          idx,
                          'up'
                        ))}><ArrowUp class="size-3.5" /></Button>
                    <Button
                      htmlType="button"
                      type="ghost"
                      size="sm"
                      aria-label="Move experience item down"
                      title="Move experience item down"
                      disabled={idx === cvState.experience.length - 1}
                      onclick={() =>
                        (cvState.experience = moveArrayItem(
                          cvState.experience,
                          idx,
                          'down'
                        ))}><ArrowDown class="size-3.5" /></Button>
                    <Button
                      htmlType="button"
                      type="danger"
                      tone="critical"
                      size="sm"
                      onclick={() => confirmRemoveCvEntry('experience', idx)}
                      >Delete</Button>
                  </div>
                </div>

                <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <FormField
                    id={'exp-title-' + idx}
                    label="Title"
                    required
                    error={experienceErrors[idx]?.title}
                    valid={experienceValid[idx]?.title}
                    counter={`${(exp.title || '').length}/50`}>
                    <Input
                      id={'exp-title-' + idx}
                      bind:value={exp.title}
                      placeholder="Ex: Software Engineer"
                      maxlength={50}
                      error={!!experienceErrors[idx]?.title}
                      valid={experienceValid[idx]?.title}
                      oninput={() => {
                        clearFieldError(
                          experienceErrors,
                          experienceValid,
                          idx,
                          'title'
                        );
                        validateExperienceField(idx, 'title', 'Title');
                      }} />
                  </FormField>

                  <FormField
                    id={'exp-type-' + idx}
                    label="Employment type"
                    required>
                    <DropdownSelect
                      placeholder="Please select"
                      options={EMPLOYMENT_TYPES.map(t => ({
                        value: t,
                        label: t
                      }))}
                      bind:value={exp.type}
                      class="w-full" />
                  </FormField>
                </div>

                <FormField
                  id={'exp-company-' + idx}
                  label="Company or organization"
                  required
                  error={experienceErrors[idx]?.company}
                  valid={experienceValid[idx]?.company}
                  counter={`${(exp.company || '').length}/100`}>
                  <Input
                    id={'exp-company-' + idx}
                    bind:value={exp.company}
                    placeholder="Ex: Berkshire Hathaway"
                    maxlength={100}
                    error={!!experienceErrors[idx]?.company}
                    valid={experienceValid[idx]?.company}
                    oninput={() => {
                      clearFieldError(
                        experienceErrors,
                        experienceValid,
                        idx,
                        'company'
                      );
                      validateExperienceField(idx, 'company', 'Company');
                    }} />
                </FormField>

                <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <FormField
                    id={'exp-location-' + idx}
                    label="Location"
                    required
                    error={experienceErrors[idx]?.location}
                    valid={experienceValid[idx]?.location}
                    counter={`${(exp.location || '').length}/100`}>
                    <Input
                      id={'exp-location-' + idx}
                      bind:value={exp.location}
                      placeholder="Ex: London, United Kingdom"
                      maxlength={100}
                      error={!!experienceErrors[idx]?.location}
                      valid={experienceValid[idx]?.location}
                      oninput={() => {
                        clearFieldError(
                          experienceErrors,
                          experienceValid,
                          idx,
                          'location'
                        );
                        validateExperienceField(idx, 'location', 'Location');
                      }} />
                  </FormField>

                  <FormField
                    id={'exp-loctype-' + idx}
                    label="Location type"
                    required>
                    <DropdownSelect
                      placeholder="Please select"
                      options={LOCATION_TYPES.map(lt => ({
                        value: lt,
                        label: lt
                      }))}
                      bind:value={exp.locType}
                      class="w-full" />
                  </FormField>
                </div>

                <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <FormField
                    id={'exp-start-month-' + idx}
                    label="Start date"
                    required>
                    <div class="grid grid-cols-2 gap-2">
                      <DropdownSelect
                        placeholder="Month"
                        options={MONTHS.map(m => ({value: m, label: m}))}
                        bind:value={exp.startMonth}
                        class="w-full" />
                      <DropdownSelect
                        placeholder="Year"
                        options={[
                          {value: null, label: 'Year'},
                          ...getStartYearOptions().map(y => ({
                            value: y,
                            label: String(y)
                          }))
                        ]}
                        bind:value={exp.startYear}
                        class="w-full" />
                    </div>
                  </FormField>

                  <FormField
                    id={'exp-end-month-' + idx}
                    label="End date (or expected)">
                    <div class="grid grid-cols-2 gap-2">
                      <DropdownSelect
                        placeholder="Month"
                        disabled={exp.currentlyIn}
                        options={[
                          {value: null, label: 'Month'},
                          ...MONTHS.map(m => ({value: m, label: m}))
                        ]}
                        bind:value={exp.endMonth}
                        class="w-full" />
                      <DropdownSelect
                        placeholder="Year"
                        disabled={exp.currentlyIn}
                        options={[
                          {value: null, label: 'Year'},
                          ...getEndYearOptions(exp.startYear).map(y => ({
                            value: y,
                            label: String(y)
                          }))
                        ]}
                        bind:value={exp.endYear}
                        class="w-full" />
                    </div>
                    <div class="mt-2">
                      <Checkbox
                        bind:checked={exp.currentlyIn}
                        label="I am currently working here"
                        onchange={e => {
                          if ((e.currentTarget as HTMLInputElement).checked) {
                            exp.endMonth = null;
                            exp.endYear = null;
                          }
                        }} />
                    </div>
                  </FormField>
                </div>

                <FormField
                  id={'exp-desc-' + idx}
                  label="Description"
                  required
                  error={experienceErrors[idx]?.description}
                  valid={experienceValid[idx]?.description}
                  counter={`${(exp.description || '').length}/1000`}>
                  <Textarea
                    id={'exp-desc-' + idx}
                    bind:value={exp.description}
                    placeholder="Describe your experience..."
                    rows={3}
                    maxlength={1000}
                    error={!!experienceErrors[idx]?.description}
                    valid={experienceValid[idx]?.description}
                    oninput={() => {
                      clearFieldError(
                        experienceErrors,
                        experienceValid,
                        idx,
                        'description'
                      );
                      validateExperienceField(
                        idx,
                        'description',
                        'Description'
                      );
                    }} />
                </FormField>
              </div>
            {/each}
          </div>

          <FormActions>
            {#if cvIsDirty}
              <p class="text-xs text-text-secondary select-none">
                You have unsaved changes.
              </p>
            {/if}
            <Button
              htmlType="submit"
              type="primary"
              size="md"
              disabled={!cvIsDirty}
              isLoading={isSavingCv}>Save Experiences</Button>
          </FormActions>
        </Card>

        <Card>
          <div class="mb-6 flex items-center justify-between gap-4">
            <div>
              <h2 class="text-xl font-bold text-text-primary">Education</h2>
              <p class="mt-1 text-xs text-text-secondary">
                List your degrees, certifications, and academic background.
              </p>
            </div>
            <Button
              htmlType="button"
              type="primary"
              size="sm"
              onclick={() => handleAddCvEntry('education')}>
              {#snippet leading()}
                <Plus class="size-3.5" />
              {/snippet}
              Add Education
            </Button>
          </div>
          <div class="flex flex-col gap-6">
            {#if cvState.education.length === 0}
              <EmptyState
                title="No education entries yet"
                description="Add your first education entry below." />
            {/if}
            {#each cvState.education as edu, idx (edu.id ?? idx)}
              <div
                class="flex flex-col gap-4 rounded-sm border border-border-subtle bg-surface-card p-4">
                <div
                  class="flex items-center justify-between border-b border-border-subtle/40 pb-2">
                  <span class="font-mono text-xs font-light text-text-muted"
                    >Education Entry #{idx + 1}</span>
                  <div class="flex items-center gap-1">
                    <Button
                      htmlType="button"
                      type="ghost"
                      size="sm"
                      aria-label="Move education item up"
                      title="Move education item up"
                      disabled={idx === 0}
                      onclick={() =>
                        (cvState.education = moveArrayItem(
                          cvState.education,
                          idx,
                          'up'
                        ))}><ArrowUp class="size-3.5" /></Button>
                    <Button
                      htmlType="button"
                      type="ghost"
                      size="sm"
                      aria-label="Move education item down"
                      title="Move education item down"
                      disabled={idx === cvState.education.length - 1}
                      onclick={() =>
                        (cvState.education = moveArrayItem(
                          cvState.education,
                          idx,
                          'down'
                        ))}><ArrowDown class="size-3.5" /></Button>
                    <Button
                      htmlType="button"
                      type="danger"
                      tone="critical"
                      size="sm"
                      onclick={() => confirmRemoveCvEntry('education', idx)}
                      >Delete</Button>
                  </div>
                </div>

                <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <FormField
                    id={'edu-inst-' + idx}
                    label="Institution"
                    required
                    error={educationErrors[idx]?.institution}
                    valid={educationValid[idx]?.institution}
                    counter={`${(edu.institution || '').length}/100`}>
                    <Input
                      id={'edu-inst-' + idx}
                      bind:value={edu.institution}
                      placeholder="Ex: Massachusetts Institute of Technology"
                      maxlength={100}
                      error={!!educationErrors[idx]?.institution}
                      valid={educationValid[idx]?.institution}
                      oninput={() => {
                        clearFieldError(
                          educationErrors,
                          educationValid,
                          idx,
                          'institution'
                        );
                        validateEducationField(
                          idx,
                          'institution',
                          'Institution'
                        );
                      }} />
                  </FormField>

                  <FormField
                    id={'edu-degree-' + idx}
                    label="Degree"
                    required
                    error={educationErrors[idx]?.degree}
                    valid={educationValid[idx]?.degree}
                    counter={`${(edu.degree || '').length}/100`}>
                    <Input
                      id={'edu-degree-' + idx}
                      bind:value={edu.degree}
                      placeholder="Ex: Bachelor of Computer Science"
                      maxlength={100}
                      error={!!educationErrors[idx]?.degree}
                      valid={educationValid[idx]?.degree}
                      oninput={() => {
                        clearFieldError(
                          educationErrors,
                          educationValid,
                          idx,
                          'degree'
                        );
                        validateEducationField(idx, 'degree', 'Degree');
                      }} />
                  </FormField>

                  <FormField
                    id={'edu-field-' + idx}
                    label="Field of Study"
                    required
                    error={educationErrors[idx]?.field}
                    valid={educationValid[idx]?.field}
                    counter={`${(edu.field || '').length}/100`}>
                    <Input
                      id={'edu-field-' + idx}
                      bind:value={edu.field}
                      placeholder="Ex: Computer Science"
                      maxlength={100}
                      error={!!educationErrors[idx]?.field}
                      valid={educationValid[idx]?.field}
                      oninput={() => {
                        clearFieldError(
                          educationErrors,
                          educationValid,
                          idx,
                          'field'
                        );
                        validateEducationField(idx, 'field', 'Field of study');
                      }} />
                  </FormField>

                  <FormField
                    id={'edu-grade-' + idx}
                    label="Grade"
                    required
                    error={educationErrors[idx]?.grade}
                    valid={educationValid[idx]?.grade}
                    counter={`${(edu.grade || '').length}/50`}>
                    <Input
                      id={'edu-grade-' + idx}
                      bind:value={edu.grade}
                      placeholder="Ex: 3.99/4.00"
                      maxlength={50}
                      error={!!educationErrors[idx]?.grade}
                      valid={educationValid[idx]?.grade}
                      oninput={() => {
                        clearFieldError(
                          educationErrors,
                          educationValid,
                          idx,
                          'grade'
                        );
                        validateEducationField(idx, 'grade', 'Grade');
                      }} />
                  </FormField>
                </div>

                <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <FormField
                    id={'edu-start-month-' + idx}
                    label="Start date"
                    required>
                    <div class="grid grid-cols-2 gap-2">
                      <DropdownSelect
                        placeholder="Month"
                        options={MONTHS.map(m => ({value: m, label: m}))}
                        bind:value={edu.startMonth}
                        class="w-full" />
                      <DropdownSelect
                        placeholder="Year"
                        options={[
                          {value: null, label: 'Year'},
                          ...getStartYearOptions().map(y => ({
                            value: y,
                            label: String(y)
                          }))
                        ]}
                        bind:value={edu.startYear}
                        class="w-full" />
                    </div>
                  </FormField>

                  <FormField
                    id={'edu-end-month-' + idx}
                    label="End date (or expected)">
                    <div class="grid grid-cols-2 gap-2">
                      <DropdownSelect
                        placeholder="Month"
                        disabled={edu.currentlyIn}
                        options={[
                          {value: null, label: 'Month'},
                          ...MONTHS.map(m => ({value: m, label: m}))
                        ]}
                        bind:value={edu.endMonth}
                        class="w-full" />
                      <DropdownSelect
                        placeholder="Year"
                        disabled={edu.currentlyIn}
                        options={[
                          {value: null, label: 'Year'},
                          ...getEndYearOptions(edu.startYear).map(y => ({
                            value: y,
                            label: String(y)
                          }))
                        ]}
                        bind:value={edu.endYear}
                        class="w-full" />
                    </div>
                    <div class="mt-2">
                      <Checkbox
                        bind:checked={edu.currentlyIn}
                        label="I am currently studying here"
                        onchange={e => {
                          if ((e.currentTarget as HTMLInputElement).checked) {
                            edu.endMonth = null;
                            edu.endYear = null;
                          }
                        }} />
                    </div>
                  </FormField>
                </div>

                <FormField
                  id={'edu-desc-' + idx}
                  label="Description"
                  required
                  error={educationErrors[idx]?.description}
                  valid={educationValid[idx]?.description}
                  counter={`${(edu.description || '').length}/1000`}>
                  <Textarea
                    id={'edu-desc-' + idx}
                    bind:value={edu.description}
                    placeholder="Describe your education..."
                    rows={3}
                    maxlength={1000}
                    error={!!educationErrors[idx]?.description}
                    valid={educationValid[idx]?.description}
                    oninput={() => {
                      clearFieldError(
                        educationErrors,
                        educationValid,
                        idx,
                        'description'
                      );
                      validateEducationField(idx, 'description', 'Description');
                    }} />
                </FormField>
              </div>
            {/each}
          </div>

          <FormActions>
            {#if cvIsDirty}
              <p class="text-xs text-text-secondary select-none">
                You have unsaved changes.
              </p>
            {/if}
            <Button
              htmlType="submit"
              type="primary"
              size="md"
              disabled={!cvIsDirty}
              isLoading={isSavingCv}>Save Education</Button>
          </FormActions>
        </Card>
      </form>

      <Card
        variant="glass"
        class="mt-10 flex flex-col gap-5">
        {#snippet header()}
          <h2 class="text-lg font-bold tracking-tight text-text-primary">
            CV Document
          </h2>
          <p class="mt-1 text-xs text-text-secondary">
            The PDF resume served across your portfolio and public API.
          </p>
        {/snippet}

        {#if pdfUploadError}
          <StatusBanner
            variant="error"
            message={pdfUploadError} />
        {/if}

        {#if pdfUploadSuccess}
          <StatusBanner
            variant="success"
            message={pdfUploadSuccess} />
        {/if}

        <div class="flex flex-col gap-5">
          {#if cvDocState && cvDocState.filename}
            <div
              class="flex flex-col gap-3 rounded-sm border border-border-subtle bg-surface-card p-4">
              <div class="flex items-center gap-3">
                <FileText class="size-6 shrink-0 text-copilot" />
                <div class="min-w-0 flex-1">
                  <p
                    class="mb-1 text-xxs font-semibold tracking-wide text-text-muted uppercase">
                    Filename
                  </p>
                  <p
                    class="font-mono text-sm font-semibold break-all text-text-primary">
                    {cvDocState.filename}
                  </p>
                  <p class="mt-1 text-xs font-semibold text-success">Live</p>
                </div>
              </div>

              {#if cvDocState.hash}
                <div class="flex flex-col gap-1">
                  <span
                    class="text-xxs font-semibold tracking-wide text-text-muted uppercase">
                    SHA-256 checksum
                  </span>
                  <div
                    class="flex items-center gap-2 rounded-sm border border-border-subtle bg-surface-base/60 px-2.5 py-2">
                    <span
                      class="min-w-0 flex-1 scrollbar-none overflow-x-auto font-mono text-xxs break-all text-text-secondary select-all [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
                      {cvDocState.hash}
                    </span>
                    <IconButton
                      variant="borderless"
                      size="sm"
                      onclick={() => {
                        navigator.clipboard
                          .writeText(cvDocState.hash || '')
                          .then(() => toastStore.success('Copied!'))
                          .catch(() => toastStore.error('Failed to copy'));
                      }}
                      ariaLabel="Copy SHA-256 checksum">
                      <Copy class="size-3.5" />
                    </IconButton>
                  </div>
                </div>
              {/if}

              <div class="flex items-center gap-2 pt-1">
                <Button
                  htmlType="button"
                  type="secondary"
                  size="sm"
                  onclick={() =>
                    window.open(cvDocState.fileUrl || '/cv.pdf', '_blank')}>
                  {#snippet leading()}
                    <ExternalLink class="size-3.5" />
                  {/snippet}
                  <span>Open CDN PDF</span>
                </Button>
                <Button
                  htmlType="button"
                  type="danger"
                  tone="critical"
                  size="sm"
                  class="ml-auto"
                  onclick={confirmDeleteCvDoc}>
                  {#snippet leading()}
                    <Trash2 class="size-3.5" />
                  {/snippet}
                  <span>Delete</span>
                </Button>
              </div>
            </div>
          {:else}
            <EmptyState
              title="No CV PDF generated yet"
              description="Click regenerate below to build your CV PDF from Supabase data." />
          {/if}

          <div
            class="flex flex-col gap-3 rounded-sm border border-border-subtle bg-surface-card p-4">
            <div class="flex flex-col gap-1">
              <span class="text-xs font-semibold text-text-primary"
                >Server-Side PDF Auto-Generator</span>
              <span class="text-xxs text-text-muted"
                >Generates a standard multi-section PDF document directly from
                your profile, experiences, education, and skills data in
                Supabase.</span>
            </div>

            <div class="flex flex-col gap-2 pt-1">
              <span
                class="text-xxs font-semibold tracking-wide text-text-muted uppercase"
                >Select Version Increment (SemVer)</span>
              <div class="grid grid-cols-3 gap-2">
                <Button
                  htmlType="button"
                  type="secondary"
                  size="sm"
                  disabled={isGeneratingPdf}
                  onclick={() => executeGenerateCvPdf('patch')}>
                  {#snippet leading()}
                    <BadgeCheck class="size-3.5" />
                  {/snippet}
                  <span>Patch (+0.0.1)</span>
                </Button>
                <Button
                  htmlType="button"
                  type="secondary"
                  size="sm"
                  disabled={isGeneratingPdf}
                  onclick={() => executeGenerateCvPdf('minor')}>
                  {#snippet leading()}
                    <PlusCircle class="size-3.5" />
                  {/snippet}
                  <span>Minor (+0.1.0)</span>
                </Button>
                <Button
                  htmlType="button"
                  type="secondary"
                  size="sm"
                  disabled={isGeneratingPdf}
                  onclick={() => executeGenerateCvPdf('major')}>
                  {#snippet leading()}
                    <Rocket class="size-3.5" />
                  {/snippet}
                  <span>Major (+1.0.0)</span>
                </Button>
              </div>
            </div>

            <Button
              htmlType="button"
              type="primary"
              size="md"
              fullWidth
              class="mt-1"
              disabled={isGeneratingPdf}
              isLoading={isGeneratingPdf}
              onclick={() => executeGenerateCvPdf('patch')}>
              {#snippet leading()}
                <Cpu class="mr-1 size-4" />
              {/snippet}
              Regenerate CV PDF Now
            </Button>
          </div>
        </div>
      </Card>
    {:else if activeAdminTab === 'skills'}
      <FormSection
        onsubmit={handleSaveSkills}
        title="Skills"
        description="Manage skill categories and the skills within each one.">
        {#snippet headerActions()}
          <Button
            htmlType="button"
            type="primary"
            size="md"
            onclick={handleAddSkill}>
            {#snippet leading()}
              <Plus class="size-3.5" />
            {/snippet}
            Add Skill
          </Button>
        {/snippet}

        {#if skillsSaveSuccess}<StatusBanner
            variant="success"
            message="Skills saved successfully!" />{/if}

        <div class="flex flex-col gap-4">
          {#if skillsState.length === 0}
            <EmptyState
              title="No skill groups yet"
              description="Add your first skill group below." />
          {/if}
          {#each skillsState as item, idx (item.id ?? idx)}
            <div
              class="flex flex-col gap-3 rounded-sm border border-border-subtle bg-surface-card p-4">
              <div
                class="flex items-center justify-between border-b border-border-subtle/40 pb-2">
                <span class="font-mono text-xs font-light text-text-muted"
                  >Category #{idx + 1}</span>
                <div class="flex items-center gap-1">
                  <Button
                    htmlType="button"
                    type="ghost"
                    size="sm"
                    aria-label="Move skill up"
                    title="Move skill up"
                    disabled={idx === 0}
                    onclick={() =>
                      (skillsState = moveArrayItem(skillsState, idx, 'up'))}
                    ><ArrowUp class="size-3.5" /></Button>
                  <Button
                    htmlType="button"
                    type="ghost"
                    size="sm"
                    aria-label="Move skill down"
                    title="Move skill down"
                    disabled={idx === skillsState.length - 1}
                    onclick={() =>
                      (skillsState = moveArrayItem(skillsState, idx, 'down'))}
                    ><ArrowDown class="size-3.5" /></Button>
                  <Button
                    htmlType="button"
                    type="danger"
                    tone="critical"
                    size="sm"
                    onclick={() => confirmRemoveSkill(idx)}>Delete</Button>
                </div>
              </div>

              <FormField
                id={'sk-cat-' + idx}
                label="Area of Expertise"
                required
                error={skillsErrors[idx]?.category}
                valid={skillsValid[idx]?.category}
                counter={`${(item.category || '').length}/100`}>
                <Input
                  id={'sk-cat-' + idx}
                  bind:value={item.category}
                  placeholder="Ex: Software Engineering"
                  maxlength={100}
                  error={!!skillsErrors[idx]?.category}
                  valid={skillsValid[idx]?.category}
                  oninput={() => {
                    clearFieldError(skillsErrors, skillsValid, idx, 'category');
                    validateSkillField(idx);
                  }}
                  onpaste={e => handleCategoryPaste(idx, e)} />
              </FormField>

              <FormField
                id={'sk-list-' + idx}
                label="Skills Set"
                counter={`${item.skills.length}/20`}>
                {#snippet hintSnippet()}
                  Up to 20 skills, 30 characters each. Separate multiple skills
                  with commas. To include a comma within a skill name, use a
                  backslash (e.g., UI\,UX Design).
                {/snippet}
                <PillInput
                  id={'sk-list-' + idx}
                  bind:value={item.skills}
                  itemLabel="Skill"
                  placeholderEmpty="Type skill and press comma..."
                  placeholderFilled="Add skill..."
                  maxItems={20}
                  maxItemLength={30}
                  onPaste={e => handleSkillsSetPaste(idx, e)} />
              </FormField>
            </div>
          {/each}
        </div>

        {#snippet actions()}
          <FormActions>
            {#if skillsIsDirty}
              <p class="text-xs text-text-secondary select-none">
                You have unsaved changes.
              </p>
            {/if}
            <Button
              htmlType="submit"
              type="primary"
              size="md"
              disabled={!skillsIsDirty}
              isLoading={isSavingSkills}>Save Skills</Button>
          </FormActions>
        {/snippet}
      </FormSection>
    {:else if activeAdminTab === 'socials'}
      <FormSection
        onsubmit={handleSaveSocials}
        title="Social Links"
        description="Manage links to your social media profiles.">
        {#snippet headerActions()}
          <Button
            htmlType="button"
            type="primary"
            size="md"
            onclick={handleAddSocial}>
            {#snippet leading()}
              <Plus class="size-3.5" />
            {/snippet}
            Add Social Link
          </Button>
        {/snippet}

        {#if socialsSaveSuccess}<StatusBanner
            variant="success"
            message="Social links saved successfully!" />{/if}

        <div class="flex flex-col gap-4">
          {#if socialState.length === 0}
            <EmptyState
              title="No social links yet"
              description="Add your first social link below." />
          {/if}
          {#each socialState as item, idx (item.id ?? idx)}
            <div
              class="flex flex-col gap-3 rounded-sm border border-border-subtle bg-surface-card p-4">
              <div
                class="flex items-center justify-between border-b border-border-subtle/40 pb-2">
                <span class="font-mono text-xs font-light text-text-muted"
                  >Social #{idx + 1}</span>
                <div class="flex items-center gap-1">
                  <Button
                    htmlType="button"
                    type="ghost"
                    size="sm"
                    aria-label="Move social link up"
                    title="Move social link up"
                    disabled={idx === 0}
                    onclick={() =>
                      (socialState = moveArrayItem(socialState, idx, 'up'))}
                    ><ArrowUp class="size-3.5" /></Button>
                  <Button
                    htmlType="button"
                    type="ghost"
                    size="sm"
                    aria-label="Move social link down"
                    title="Move social link down"
                    disabled={idx === socialState.length - 1}
                    onclick={() =>
                      (socialState = moveArrayItem(socialState, idx, 'down'))}
                    ><ArrowDown class="size-3.5" /></Button>
                  <Button
                    htmlType="button"
                    type="danger"
                    tone="critical"
                    size="sm"
                    onclick={() => confirmRemoveSocial(idx)}>Delete</Button>
                </div>
              </div>

              <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <FormField
                  id={'soc-plat-' + idx}
                  label="Platform"
                  required
                  error={socialErrors[idx]?.platform}
                  valid={socialValid[idx]?.platform}
                  counter={`${(item.platform || '').length}/50`}>
                  <Input
                    id={'soc-plat-' + idx}
                    bind:value={item.platform}
                    placeholder="Ex: GitHub"
                    maxlength={50}
                    error={!!socialErrors[idx]?.platform}
                    valid={socialValid[idx]?.platform}
                    oninput={() => {
                      clearFieldError(
                        socialErrors,
                        socialValid,
                        idx,
                        'platform'
                      );
                      validateSocialField(idx, 'platform');
                    }} />
                </FormField>

                <FormField
                  id={'soc-url-' + idx}
                  label="URL"
                  required
                  error={socialErrors[idx]?.url}
                  valid={socialValid[idx]?.url}
                  counter={`${(item.url || '').length}/100`}>
                  <Input
                    id={'soc-url-' + idx}
                    bind:value={item.url}
                    placeholder="Ex: https://github.com/torvalds"
                    maxlength={100}
                    error={!!socialErrors[idx]?.url}
                    valid={socialValid[idx]?.url}
                    oninput={() => {
                      clearFieldError(socialErrors, socialValid, idx, 'url');
                      validateSocialField(idx, 'url');
                    }} />
                </FormField>
              </div>
            </div>
          {/each}
        </div>

        {#snippet actions()}
          <FormActions>
            {#if socialIsDirty}
              <p class="text-xs text-text-secondary select-none">
                You have unsaved changes.
              </p>
            {/if}
            <Button
              htmlType="submit"
              type="primary"
              size="md"
              disabled={!socialIsDirty}
              isLoading={isSavingSocials}>Save Social Links</Button>
          </FormActions>
        {/snippet}
      </FormSection>
    {:else if activeAdminTab === 'sponsorship'}
      <FormSection
        onsubmit={handleSaveSponsorship}
        title="Sponsorship"
        description="Manage funding and sponsorship platforms.">
        {#snippet headerActions()}
          <Button
            htmlType="button"
            type="primary"
            size="md"
            onclick={handleAddSponsorship}>
            {#snippet leading()}
              <Plus class="size-3.5" />
            {/snippet}
            Add Sponsorship
          </Button>
        {/snippet}

        {#if sponsorshipSaveSuccess}<StatusBanner
            variant="success"
            message="Sponsorship links saved successfully!" />{/if}

        <div class="flex flex-col gap-4">
          {#if sponsorshipState.length === 0}
            <EmptyState
              title="No funding platforms yet"
              description="Add your first funding platform below." />
          {/if}
          {#each sponsorshipState as item, idx (item.id ?? idx)}
            <div
              class="flex flex-col gap-3 rounded-sm border border-border-subtle bg-surface-card p-4">
              <div
                class="flex items-center justify-between border-b border-border-subtle/40 pb-2">
                <span class="font-mono text-xs font-light text-text-muted"
                  >Sponsorship #{idx + 1}</span>
                <div class="flex items-center gap-1">
                  <Button
                    htmlType="button"
                    type="ghost"
                    size="sm"
                    aria-label="Move sponsorship link up"
                    title="Move sponsorship link up"
                    disabled={idx === 0}
                    onclick={() =>
                      (sponsorshipState = moveArrayItem(
                        sponsorshipState,
                        idx,
                        'up'
                      ))}><ArrowUp class="size-3.5" /></Button>
                  <Button
                    htmlType="button"
                    type="ghost"
                    size="sm"
                    aria-label="Move sponsorship link down"
                    title="Move sponsorship link down"
                    disabled={idx === sponsorshipState.length - 1}
                    onclick={() =>
                      (sponsorshipState = moveArrayItem(
                        sponsorshipState,
                        idx,
                        'down'
                      ))}><ArrowDown class="size-3.5" /></Button>
                  <Button
                    htmlType="button"
                    type="danger"
                    tone="critical"
                    size="sm"
                    onclick={() => confirmRemoveSponsorship(idx)}
                    >Delete</Button>
                </div>
              </div>

              <div class="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <FormField
                  id={'sp-plat-' + idx}
                  label="Platform"
                  required
                  error={sponsorshipErrors[idx]?.platform}
                  valid={sponsorshipValid[idx]?.platform}
                  counter={`${(item.platform || '').length}/50`}>
                  <Input
                    id={'sp-plat-' + idx}
                    bind:value={item.platform}
                    placeholder="Ex: Ko-fi"
                    maxlength={50}
                    error={!!sponsorshipErrors[idx]?.platform}
                    valid={sponsorshipValid[idx]?.platform}
                    oninput={() => {
                      clearFieldError(
                        sponsorshipErrors,
                        sponsorshipValid,
                        idx,
                        'platform'
                      );
                      validateSponsorshipField(idx, 'platform');
                    }} />
                </FormField>

                <FormField
                  id={'sp-val-' + idx}
                  label="Display Text"
                  required
                  error={sponsorshipErrors[idx]?.displayValue}
                  valid={sponsorshipValid[idx]?.displayValue}
                  counter={`${(item.displayValue || '').length}/50`}>
                  <Input
                    id={'sp-val-' + idx}
                    bind:value={item.displayValue}
                    placeholder="Ex: @farhnkrnapratma"
                    maxlength={50}
                    error={!!sponsorshipErrors[idx]?.displayValue}
                    valid={sponsorshipValid[idx]?.displayValue}
                    oninput={() => {
                      clearFieldError(
                        sponsorshipErrors,
                        sponsorshipValid,
                        idx,
                        'displayValue'
                      );
                      validateSponsorshipField(idx, 'displayValue');
                    }} />
                </FormField>

                <FormField
                  id={'sp-url-' + idx}
                  label="URL"
                  required
                  error={sponsorshipErrors[idx]?.url}
                  valid={sponsorshipValid[idx]?.url}
                  counter={`${(item.url || '').length}/100`}>
                  <Input
                    id={'sp-url-' + idx}
                    bind:value={item.url}
                    placeholder="Ex: https://ko-fi.com/farhnkrnapratma"
                    maxlength={100}
                    error={!!sponsorshipErrors[idx]?.url}
                    valid={sponsorshipValid[idx]?.url}
                    oninput={() => {
                      clearFieldError(
                        sponsorshipErrors,
                        sponsorshipValid,
                        idx,
                        'url'
                      );
                      validateSponsorshipField(idx, 'url');
                    }} />
                </FormField>
              </div>

              <FormField
                id={'sp-desc-' + idx}
                label="Description"
                counter={`${(item.description || '').length}/1000`}>
                <Textarea
                  id={'sp-desc-' + idx}
                  bind:value={item.description}
                  placeholder="Describe why they must sponsoring you..."
                  rows={2}
                  maxlength={1000} />
              </FormField>
            </div>
          {/each}
        </div>

        {#snippet actions()}
          <FormActions>
            {#if sponsorshipIsDirty}
              <p class="text-xs text-text-secondary select-none">
                You have unsaved changes.
              </p>
            {/if}
            <Button
              htmlType="submit"
              type="primary"
              size="md"
              disabled={!sponsorshipIsDirty}
              isLoading={isSavingSponsorship}>Save Sponsorship</Button>
          </FormActions>
        {/snippet}
      </FormSection>
    {:else if activeAdminTab === 'contact'}
      <FormSection
        onsubmit={handleSaveContact}
        title="Contact"
        description="Manage public contact channels.">
        {#snippet headerActions()}
          <Button
            htmlType="button"
            type="primary"
            size="md"
            onclick={handleAddContact}>
            {#snippet leading()}
              <Plus class="size-3.5" />
            {/snippet}
            Add Contact
          </Button>
        {/snippet}

        {#if contactSaveSuccess}<StatusBanner
            variant="success"
            message="Contact info saved successfully!" />{/if}

        <div class="flex flex-col gap-4">
          {#if contactState.length === 0}
            <EmptyState
              title="No contact channels yet"
              description="Add your first contact channel below." />
          {/if}
          {#each contactState as item, idx (item.id ?? idx)}
            <div
              class="flex flex-col gap-3 rounded-sm border border-border-subtle bg-surface-card p-4">
              <div
                class="flex items-center justify-between border-b border-border-subtle/40 pb-2">
                <span class="font-mono text-xs font-light text-text-muted"
                  >Contact #{idx + 1}</span>
                <div class="flex items-center gap-1">
                  <Button
                    htmlType="button"
                    type="ghost"
                    size="sm"
                    aria-label="Move contact item up"
                    title="Move contact item up"
                    disabled={idx === 0}
                    onclick={() =>
                      (contactState = moveArrayItem(contactState, idx, 'up'))}
                    ><ArrowUp class="size-3.5" /></Button>
                  <Button
                    htmlType="button"
                    type="ghost"
                    size="sm"
                    aria-label="Move contact item down"
                    title="Move contact item down"
                    disabled={idx === contactState.length - 1}
                    onclick={() =>
                      (contactState = moveArrayItem(contactState, idx, 'down'))}
                    ><ArrowDown class="size-3.5" /></Button>
                  <Button
                    htmlType="button"
                    type="danger"
                    tone="critical"
                    size="sm"
                    onclick={() => confirmRemoveContact(idx)}>Delete</Button>
                </div>
              </div>

              <div class="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <FormField
                  id={'ct-plat-' + idx}
                  label="Platform"
                  required
                  error={contactErrors[idx]?.platform}
                  valid={contactValid[idx]?.platform}
                  counter={`${(item.platform || '').length}/50`}>
                  <Input
                    id={'ct-plat-' + idx}
                    bind:value={item.platform}
                    placeholder="Ex: Email"
                    maxlength={50}
                    error={!!contactErrors[idx]?.platform}
                    valid={contactValid[idx]?.platform}
                    oninput={() => {
                      clearFieldError(
                        contactErrors,
                        contactValid,
                        idx,
                        'platform'
                      );
                      validateContactField(idx, 'platform');
                    }} />
                </FormField>

                <FormField
                  id={'ct-val-' + idx}
                  label="Display Text"
                  required
                  error={contactErrors[idx]?.displayValue}
                  valid={contactValid[idx]?.displayValue}
                  counter={`${(item.displayValue || '').length}/50`}>
                  <Input
                    id={'ct-val-' + idx}
                    bind:value={item.displayValue}
                    placeholder="Ex: contact@example.com"
                    maxlength={50}
                    error={!!contactErrors[idx]?.displayValue}
                    valid={contactValid[idx]?.displayValue}
                    oninput={() => {
                      clearFieldError(
                        contactErrors,
                        contactValid,
                        idx,
                        'displayValue'
                      );
                      validateContactField(idx, 'displayValue');
                    }} />
                </FormField>

                <FormField
                  id={'ct-url-' + idx}
                  label="URL"
                  required
                  error={contactErrors[idx]?.href}
                  valid={contactValid[idx]?.href}
                  counter={`${(item.href || '').length}/100`}>
                  <Input
                    id={'ct-url-' + idx}
                    bind:value={item.href}
                    placeholder="Ex: mailto:contact@example.com"
                    maxlength={100}
                    error={!!contactErrors[idx]?.href}
                    valid={contactValid[idx]?.href}
                    oninput={() => {
                      clearFieldError(contactErrors, contactValid, idx, 'href');
                      validateContactField(idx, 'href');
                    }} />
                </FormField>
              </div>
            </div>
          {/each}
        </div>

        {#snippet actions()}
          <FormActions>
            {#if contactIsDirty}
              <p class="text-xs text-text-secondary select-none">
                You have unsaved changes.
              </p>
            {/if}
            <Button
              htmlType="submit"
              type="primary"
              size="md"
              disabled={!contactIsDirty}
              isLoading={isSavingContact}>Save Contact</Button>
          </FormActions>
        {/snippet}
      </FormSection>
    {:else if activeAdminTab === 'privacy'}
      <FormSection
        title="Privacy Policy"
        description="Edit and publish your website Privacy Policy in Markdown."
        onsubmit={e => handleSaveLegalPage('privacy', e)}
        class="py-4 sm:py-6"
        bare>
        {#snippet headerActions()}
          <Button
            htmlType="submit"
            type="primary"
            size="md"
            isLoading={isSavingLegal}
            disabled={isSavingLegal}>
            Save Privacy Policy
          </Button>
        {/snippet}
        <MarkdownEditor
          bind:value={legalPagesData.privacy.content}
          autosaveKey="autosave_legal_privacy"
          placeholder="Write your Privacy Policy content in markdown..."
          minHeight="500px" />
      </FormSection>
    {:else if activeAdminTab === 'security'}
      <FormSection
        title="Security Policy"
        description="Edit and publish your website Security Policy & Vulnerability Disclosure Guidelines."
        onsubmit={e => handleSaveLegalPage('security', e)}
        class="py-4 sm:py-6"
        bare>
        {#snippet headerActions()}
          <Button
            htmlType="submit"
            type="primary"
            size="md"
            isLoading={isSavingLegal}
            disabled={isSavingLegal}>
            Save Security Policy
          </Button>
        {/snippet}
        <MarkdownEditor
          bind:value={legalPagesData.security.content}
          autosaveKey="autosave_legal_security"
          placeholder="Write your Security Policy content in markdown..."
          minHeight="500px" />
      </FormSection>
    {:else if activeAdminTab === 'terms'}
      <FormSection
        title="Terms of Service"
        description="Edit and publish your website Terms of Service."
        onsubmit={e => handleSaveLegalPage('terms', e)}
        class="py-4 sm:py-6"
        bare>
        {#snippet headerActions()}
          <Button
            htmlType="submit"
            type="primary"
            size="md"
            isLoading={isSavingLegal}
            disabled={isSavingLegal}>
            Save Terms of Service
          </Button>
        {/snippet}
        <MarkdownEditor
          bind:value={legalPagesData.terms.content}
          autosaveKey="autosave_legal_terms"
          placeholder="Write your Terms of Service content in markdown..."
          minHeight="500px" />
      </FormSection>
    {/if}
  </main>
</div>

<ConfirmationDialog
  bind:isOpen={showDeletePostDialog}
  title="Delete Post"
  message={`Are you sure you want to delete post "${postToDelete?.title}"?`}
  confirmLabel="Delete"
  isDestructive
  onConfirm={executeDeletePost} />

<ConfirmationDialog
  bind:isOpen={showDeleteCommentDialog}
  title="Delete Comment"
  message="Are you sure you want to delete this comment?"
  confirmLabel="Delete"
  isDestructive
  onConfirm={executeDeleteComment} />

<ConfirmationDialog
  bind:isOpen={showClearAuthorDialog}
  title="Delete Profile"
  message="Are you sure you want to delete/clear all author profile data from the database?"
  confirmLabel="Delete"
  isDestructive
  isLoading={isClearingAuthor}
  onConfirm={executeClearAuthor} />

<ConfirmationDialog
  bind:isOpen={showDeleteCvDocDialog}
  title="Delete CV Document"
  message={`Delete CV document "${cvDocState.filename}" from CDN & database?`}
  confirmLabel="Delete"
  isDestructive
  onConfirm={executeDeleteCvDoc} />

<ConfirmationDialog
  bind:isOpen={showRemoveEntryDialog}
  title="Remove entry"
  message={removeEntryMessage}
  confirmLabel="Remove"
  isDestructive
  onConfirm={executeRemoveEntry}
  onCancel={() => (pendingRemove = null)} />

<Dialog
  bind:isOpen={showAvatarPreviewDialog}
  onClose={() => (showAvatarPreviewDialog = false)}
  title="Avatar Preview"
  size="sm">
  <div
    class="relative flex aspect-square w-full items-center justify-center overflow-hidden rounded-sm border border-border-subtle bg-surface-base">
    {#if authorState.avatar}
      <div
        class="absolute inset-0 z-0 flex items-center justify-center bg-surface-subtle">
        <User class="size-12 text-text-muted" />
      </div>
      {#key authorState.avatar}
        <img
          src={authorState.avatar}
          alt="Avatar preview enlarged"
          class="relative z-10 h-full w-full object-cover"
          onerror={e =>
            ((e.currentTarget as HTMLImageElement).style.display = 'none')}
          onload={e =>
            ((e.currentTarget as HTMLImageElement).style.display = 'block')} />
      {/key}
    {:else}
      <div
        class="flex h-full w-full items-center justify-center bg-surface-subtle">
        <User class="size-12 text-text-muted" />
      </div>
    {/if}

    <IconButton
      ariaLabel="Close dialog"
      variant="borderless"
      size="sm"
      class="absolute top-2 right-2 bg-black/40! text-white! hover:bg-black/60!"
      onclick={() => (showAvatarPreviewDialog = false)}>
      <X class="size-4" />
    </IconButton>
  </div>

  {#snippet footer()}
    <div class="flex w-full items-center justify-between">
      <Button
        htmlType="button"
        type="danger"
        tone="critical"
        size="md"
        onclick={() => {
          authorState.avatar = '';
          showAvatarPreviewDialog = false;
          onAuthorInput('avatar');
        }}>
        Delete
      </Button>
      <Button
        htmlType="button"
        type="primary"
        size="md"
        onclick={() => (showAvatarPreviewDialog = false)}>
        Looks good
      </Button>
    </div>
  {/snippet}
</Dialog>

<style>
  @reference "../global.css";
  .editor-textarea,
  .editor-pre,
  .editor-pre code,
  .editor-pre :global(span),
  .line-num-item {
    @apply font-mono text-[14.5px]! leading-6! tracking-normal! normal-case!;
    font-feature-settings: var(--font-feature-settings-mono) !important;
  }

  .editor-textarea,
  .editor-pre {
    @apply wrap-break-word!;
    word-break: normal !important;
  }

  .editor-textarea {
    @apply m-0! box-border! border-0! outline-hidden!;
  }

  .editor-textarea:focus,
  .editor-textarea:focus-visible {
    @apply border-transparent! shadow-none! outline-hidden!;
    --tw-ring-shadow: none !important;
  }

  .editor-code-line {
    @apply block! min-h-6! leading-6!;
  }

  .line-num-item {
    @apply box-border! flex! h-6 items-start! justify-end!;
  }

  .prose-custom :global(h1),
  .prose-custom :global(h2),
  .prose-custom :global(h3) {
    @apply font-sans;
  }

  .prose-custom {
    @apply font-sans text-[0.9rem] leading-[1.7] text-(--color-body);
    --color-heading: var(--color-gh-gray-6);
    --color-body: var(--color-gh-gray-5);
    --color-link: var(--color-copilot);
    --color-link-hover: var(--color-copilot);
  }

  :global(:root.dark) .prose-custom {
    --color-heading: var(--color-gh-gray-1);
    --color-body: var(--color-gh-gray-3);
    --color-link: var(--color-copilot);
    --color-link-hover: var(--color-copilot);
  }

  .prose-custom :global(p) {
    @apply mt-5 mb-5 text-(--color-body);
  }

  .prose-custom :global(h1),
  .prose-custom :global(h2),
  .prose-custom :global(h3),
  .prose-custom :global(h4),
  .prose-custom :global(h5),
  .prose-custom :global(h6) {
    @apply font-sans text-(--color-heading);
  }

  .prose-custom :global(h1) {
    @apply mt-8 mb-4 text-3xl font-extrabold;
  }

  .prose-custom :global(h2) {
    @apply mt-7 mb-3 text-2xl font-bold;
  }

  .prose-custom :global(h3) {
    @apply mt-6 mb-2 text-xl font-semibold;
  }

  .prose-custom :global(ul) {
    @apply mt-4 mb-4 list-disc pl-6;
  }

  .prose-custom :global(ol) {
    @apply mt-4 mb-4 list-decimal pl-6;
  }

  .prose-custom :global(li) {
    @apply mt-1 mb-1;
  }

  .prose-custom :global(pre) {
    @apply mt-6 mb-6 scrollbar-none! overflow-x-auto rounded-sm border border-border-subtle bg-surface-hover px-3! py-2! font-mono text-[0.8rem] leading-relaxed break-normal! whitespace-pre! [-ms-overflow-style:none]!;
  }

  .prose-custom :global(pre[data-enhanced='true']) {
    @apply pr-3.5! pl-0!;
  }

  .prose-custom :global(pre)::-webkit-scrollbar {
    @apply hidden! h-0! w-0!;
  }

  .prose-custom :global(code:not(pre code)) {
    @apply rounded bg-surface-hover px-1 py-px font-mono text-xs font-normal text-inherit;
    overflow-wrap: break-word;
    word-break: break-word;
  }

  .prose-custom :global(pre code) {
    @apply block! w-max! min-w-full! overflow-visible! border-0 bg-transparent py-0! pr-3.5! pl-0! font-mono text-[0.8rem] leading-relaxed break-normal! whitespace-pre! text-inherit;
  }

  .prose-custom :global(.code-line) {
    @apply block! w-full! pr-3.5! pl-2!;
  }

  .prose-custom :global(pre.code-wrap .code-line),
  .prose-custom :global(pre[data-wrap='true'] .code-line) {
    padding-left: calc(0.5rem + 4ch) !important;
    text-indent: -4ch;
  }

  .prose-custom :global(a) {
    @apply text-(--color-link) underline;
  }

  .prose-custom :global(a):hover {
    @apply text-(--color-link-hover);
  }

  .prose-custom :global(.heading-text) {
    @apply inline! transition-none!;
  }

  .prose-custom :global(a.anchor-link) {
    @apply ml-[0.35rem]! inline-flex! items-center! justify-center! align-middle! leading-none! whitespace-nowrap! text-text-primary! no-underline! transition-none!;
  }

  :global(:root.dark) .prose-custom :global(a.anchor-link) {
    @apply text-gh-gray-4!;
  }

  .prose-custom :global(a.anchor-link svg) {
    @apply inline-block! align-middle! text-[0.85em]! leading-none! text-inherit! no-underline!;
  }

  .prose-custom :global(h1:hover .heading-text),
  .prose-custom :global(h2:hover .heading-text),
  .prose-custom :global(h3:hover .heading-text),
  .prose-custom :global(h4:hover .heading-text),
  .prose-custom :global(h5:hover .heading-text),
  .prose-custom :global(h6:hover .heading-text),
  .prose-custom :global(.heading-text):hover,
  :global(:root.dark) .prose-custom :global(h1:hover .heading-text),
  :global(:root.dark) .prose-custom :global(h2:hover .heading-text),
  :global(:root.dark) .prose-custom :global(h3:hover .heading-text),
  :global(:root.dark) .prose-custom :global(h4:hover .heading-text),
  :global(:root.dark) .prose-custom :global(h5:hover .heading-text),
  :global(:root.dark) .prose-custom :global(h6:hover .heading-text),
  :global(:root.dark) .prose-custom :global(.heading-text):hover {
    @apply text-copilot underline underline-offset-4;
  }

  .prose-custom :global(h1:hover a.anchor-link),
  .prose-custom :global(h2:hover a.anchor-link),
  .prose-custom :global(h3:hover a.anchor-link),
  .prose-custom :global(h4:hover a.anchor-link),
  .prose-custom :global(h5:hover a.anchor-link),
  .prose-custom :global(h6:hover a.anchor-link),
  .prose-custom :global(a.anchor-link):hover,
  :global(:root.dark) .prose-custom :global(h1:hover a.anchor-link),
  :global(:root.dark) .prose-custom :global(h2:hover a.anchor-link),
  :global(:root.dark) .prose-custom :global(h3:hover a.anchor-link),
  :global(:root.dark) .prose-custom :global(h4:hover a.anchor-link),
  :global(:root.dark) .prose-custom :global(h5:hover a.anchor-link),
  :global(:root.dark) .prose-custom :global(h6:hover a.anchor-link),
  :global(:root.dark) .prose-custom :global(a.anchor-link):hover,
  .prose-custom :global(h1:hover a.anchor-link svg),
  .prose-custom :global(h2:hover a.anchor-link svg),
  .prose-custom :global(h3:hover a.anchor-link svg),
  .prose-custom :global(h4:hover a.anchor-link svg),
  .prose-custom :global(h5:hover a.anchor-link svg),
  .prose-custom :global(h6:hover a.anchor-link svg),
  .prose-custom :global(a.anchor-link):hover :global(svg),
  :global(:root.dark) .prose-custom :global(h1:hover a.anchor-link svg),
  :global(:root.dark) .prose-custom :global(h2:hover a.anchor-link svg),
  :global(:root.dark) .prose-custom :global(h3:hover a.anchor-link svg),
  :global(:root.dark) .prose-custom :global(h4:hover a.anchor-link svg),
  :global(:root.dark) .prose-custom :global(h5:hover a.anchor-link svg),
  :global(:root.dark) .prose-custom :global(h6:hover a.anchor-link svg),
  :global(:root.dark) .prose-custom :global(a.anchor-link):hover :global(svg) {
    @apply text-copilot! no-underline! opacity-100;
  }

  .prose-custom :global(table) {
    @apply my-6 w-full max-w-full overflow-hidden rounded-sm border border-border-subtle text-left text-xs shadow-2xs;
    border-collapse: separate;
    border-spacing: 0;
    table-layout: fixed;
  }

  .prose-custom :global(thead) {
    @apply border-b border-border-subtle bg-surface-hover/80 font-semibold tracking-wider text-text-primary uppercase;
  }

  .prose-custom :global(th) {
    @apply px-2.5 py-2 text-center font-semibold text-text-primary;
    overflow-wrap: break-word;
    word-break: break-word;
  }

  .prose-custom :global(tbody tr) {
    @apply transition-colors hover:bg-surface-hover/30;
  }

  .prose-custom :global(td) {
    @apply border-r border-border-subtle/40 px-2.5 py-1.5 text-left leading-relaxed text-text-secondary last:border-r-0;
    overflow-wrap: break-word;
    word-break: break-word;
  }

  .prose-custom :global(td code),
  .prose-custom :global(th code) {
    overflow-wrap: anywhere;
    word-break: break-word;
    white-space: normal;
  }

  .prose-custom :global(td[align='right']) {
    @apply text-right;
  }

  .prose-custom :global(td[align='center']) {
    @apply text-center;
  }

  .prose-custom :global(hr) {
    @apply my-8 h-px border-0 bg-border-default;
  }

  .prose-custom :global(.markdown-alert) {
    @apply my-6 rounded-r-xl border-l-4 p-4 text-xs shadow-2xs transition-colors duration-200 sm:text-sm;
  }

  .prose-custom :global(.markdown-alert-title) {
    @apply mb-1.5 flex items-center gap-2 text-xs font-bold select-none sm:text-sm;
  }

  .prose-custom :global(.markdown-alert-content) {
    @apply leading-relaxed text-text-secondary;
  }

  .prose-custom :global(.markdown-alert-content > p) {
    @apply my-1 text-text-secondary;
  }

  .prose-custom :global(.markdown-alert-content > *:first-child) {
    @apply mt-0!;
  }

  .prose-custom :global(.markdown-alert-content > *:last-child) {
    @apply mb-0!;
  }

  .prose-custom :global(.markdown-alert-note) {
    @apply border-(--color-security) bg-security-subtle text-(--color-body);
  }
  .prose-custom :global(.markdown-alert-note .markdown-alert-title) {
    @apply text-(--color-security);
  }

  .prose-custom :global(.markdown-alert-tip) {
    @apply border-(--color-success) bg-(--color-success-subtle) text-(--color-body);
  }
  .prose-custom :global(.markdown-alert-tip .markdown-alert-title) {
    @apply text-(--color-success);
  }

  .prose-custom :global(.markdown-alert-important) {
    @apply border-(--color-copilot) bg-copilot-subtle text-(--color-body);
  }
  .prose-custom :global(.markdown-alert-important .markdown-alert-title) {
    @apply text-(--color-copilot);
  }

  .prose-custom :global(.markdown-alert-warning) {
    @apply border-(--color-warning) bg-warning-subtle text-(--color-body);
  }
  .prose-custom :global(.markdown-alert-warning .markdown-alert-title) {
    @apply text-(--color-warning-strong);
  }

  .prose-custom :global(.markdown-alert-caution) {
    @apply border-(--color-danger) bg-danger-subtle text-(--color-body);
  }
  .prose-custom :global(.markdown-alert-caution .markdown-alert-title) {
    @apply text-(--color-danger);
  }
  .prose-custom > :global(*:first-child) {
    @apply mt-0!;
  }
</style>
