/** @format */

export interface ExperienceItem {
  id?: string
  title: string
  type: string
  company: string
  startMonth: string
  startYear: number
  endMonth?: string | null
  endYear?: number | null
  currentlyIn: boolean
  location: string
  locType: string
  description: string
  sortOrder?: number
}

export interface EducationItem {
  id?: string
  institution: string
  degree: string
  field: string
  startMonth: string
  startYear: number
  endMonth?: string | null
  endYear?: number | null
  currentlyIn: boolean
  grade: string
  description: string
  sortOrder?: number
}

export interface SkillItem {
  id?: string
  category: string
  skills: string[]
  sortOrder?: number
}

export interface SkillCategoryGroup {
  id?: string
  category: string
  items: string[]
  sortOrder?: number
}

export interface SocialLink {
  id?: string
  platform: string
  url: string
  icon: string
  sortOrder?: number
}

export interface SponsorshipLink {
  id?: string
  platform: string
  displayValue: string
  url: string
  icon: string
  description: string
  sortOrder?: number
}

export interface ContactInfo {
  id?: string
  platform: string
  displayValue: string
  href: string
  icon: string
  sortOrder?: number
}

export interface CvDocument {
  id?: string
  filename: string
  fileUrl: string
  hash?: string
  isActive: boolean
  sortOrder?: number
  updatedAt?: string
}

export interface AuthorProfile {
  id?: string
  name: string
  username: string
  headline: string
  jobTitle: string
  bio: string
  avatar: string
  email: string
  city: string
  postalCode: string
  country: string
  siteUrl: string
  skills?: (string | SkillCategoryGroup)[]
  socials?: Record<string, string>
  socialLinks?: SocialLink[]
  experience?: ExperienceItem[]
  education?: EducationItem[]
}

export function decodeHtmlEntities(str: string | null | undefined): string {
  if (!str) return ''
  return str
    .replace(/&#x2F;/gi, '/')
    .replace(/&#x27;/gi, "'")
    .replace(/&#x22;/gi, '"')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
}

export function formatMonthFull(month: string | null | undefined): string {
  if (!month) return ''
  const decoded = decodeHtmlEntities(month).trim()
  if (!decoded) return ''
  const m = decoded.toLowerCase().replace(/\./g, '')
  const map: Record<string, string> = {
    jan: 'January',
    january: 'January',
    '01': 'January',
    '1': 'January',
    feb: 'February',
    february: 'February',
    '02': 'February',
    '2': 'February',
    mar: 'March',
    march: 'March',
    '03': 'March',
    '3': 'March',
    apr: 'April',
    april: 'April',
    '04': 'April',
    '4': 'April',
    may: 'May',
    '05': 'May',
    '5': 'May',
    jun: 'June',
    june: 'June',
    '06': 'June',
    '6': 'June',
    jul: 'July',
    july: 'July',
    '07': 'July',
    '7': 'July',
    aug: 'August',
    august: 'August',
    '08': 'August',
    '8': 'August',
    sep: 'September',
    september: 'September',
    '09': 'September',
    '9': 'September',
    oct: 'October',
    october: 'October',
    '10': 'October',
    nov: 'November',
    november: 'November',
    '11': 'November',
    dec: 'December',
    december: 'December',
    '12': 'December'
  }
  return (
    map[m] || decoded.charAt(0).toUpperCase() + decoded.slice(1).toLowerCase()
  )
}

export function formatMonthAbbrev(month: string | null | undefined): string {
  if (!month) return ''
  const decoded = decodeHtmlEntities(month).trim()
  if (!decoded) return ''
  const m = decoded.toLowerCase().replace(/\./g, '')
  const map: Record<string, string> = {
    jan: 'Jan',
    january: 'Jan',
    '01': 'Jan',
    '1': 'Jan',
    feb: 'Feb',
    february: 'Feb',
    '02': 'Feb',
    '2': 'Feb',
    mar: 'Mar',
    march: 'Mar',
    '03': 'Mar',
    '3': 'Mar',
    apr: 'Apr',
    april: 'Apr',
    '04': 'Apr',
    '4': 'Apr',
    may: 'May',
    '05': 'May',
    '5': 'May',
    jun: 'Jun',
    june: 'Jun',
    '06': 'Jun',
    '6': 'Jun',
    jul: 'Jul',
    july: 'Jul',
    '07': 'Jul',
    '7': 'Jul',
    aug: 'Aug',
    august: 'Aug',
    '08': 'Aug',
    '8': 'Aug',
    sep: 'Sep',
    september: 'Sep',
    '09': 'Sep',
    '9': 'Sep',
    oct: 'Oct',
    october: 'Oct',
    '10': 'Oct',
    nov: 'Nov',
    november: 'Nov',
    '11': 'Nov',
    dec: 'Dec',
    december: 'Dec',
    '12': 'Dec'
  }
  return (
    map[m]
    || decoded.charAt(0).toUpperCase() + decoded.slice(1, 3).toLowerCase()
  )
}

export function sanitizeIconClass(
  icon: string | undefined,
  fallback: string
): string {
  if (!icon || !icon.trim()) return fallback
  const trimmed = icon.trim()
  if (trimmed.startsWith('bi bi-')) return trimmed
  if (trimmed.startsWith('bi-')) return `bi ${trimmed}`
  return `bi bi-${trimmed}`
}

export async function fetchAuthorProfile(
  supabaseClient?: any,
  options?: {includeEmail?: boolean}
): Promise<AuthorProfile | null> {
  if (!supabaseClient) return null

  try {
    const {data, error} = await supabaseClient
      .from('db_profiles')
      .select('*')
      .limit(1)
      .maybeSingle()

    if (error || !data) {
      return null
    }

    const rawName = decodeHtmlEntities(data.name || '')
    const city = decodeHtmlEntities(data.city || '')
    const postalCode = decodeHtmlEntities(data.postal_code || '')
    const country = decodeHtmlEntities(data.country || '')

    return {
      id: data.id,
      name: rawName,
      username: decodeHtmlEntities(data.username || ''),
      headline: decodeHtmlEntities(data.headline || ''),
      jobTitle: decodeHtmlEntities(data.job_title || ''),
      bio: decodeHtmlEntities(data.bio || ''),
      avatar: decodeHtmlEntities(data.avatar || ''),
      // Not returned unless explicitly requested (admin editor only) - this
      // is the site's Supabase Auth login identity and must not leak into
      // any publicly-served page data or API response.
      email: options?.includeEmail ? decodeHtmlEntities(data.email || '') : '',
      city,
      postalCode,
      country,
      siteUrl: decodeHtmlEntities(data.site_url || ''),
      skills: [],
      socials: {},
      socialLinks: [],
      experience: [],
      education: []
    }
  } catch (e) {
    return null
  }
}

export async function fetchAuthorProfileWithSocials(
  supabaseClient?: any,
  options?: {includeEmail?: boolean}
): Promise<AuthorProfile | null> {
  const [profile, socialLinks] = await Promise.all([
    fetchAuthorProfile(supabaseClient, options),
    fetchSocials(supabaseClient)
  ])
  if (!profile) return null
  return {...profile, socialLinks}
}

export async function fetchSocials(
  supabaseClient?: any
): Promise<SocialLink[]> {
  if (!supabaseClient) return []

  try {
    const {data, error} = await supabaseClient
      .from('db_links')
      .select('*')
      .eq('category', 'social')
      .order('sort_order', {ascending: true})

    if (error || !data) return []

    return data.map((item: any) => ({
      id: item.id,
      platform: item.platform,
      url: item.url,
      icon: item.icon || 'bi-people',
      sortOrder: item.sort_order
    }))
  } catch (e) {
    return []
  }
}

export async function fetchSkills(supabaseClient?: any): Promise<SkillItem[]> {
  if (!supabaseClient) return []

  try {
    const {data, error} = await supabaseClient
      .from('db_categories')
      .select('id, category, sort_order, db_items(id, name, sort_order)')
      .order('sort_order', {ascending: true})

    if (error || !data) return []

    return data.map((cat: any) => ({
      id: cat.id,
      category: decodeHtmlEntities(cat.category || ''),
      skills: (cat.db_items || [])
        .sort((a: any, b: any) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
        .map((item: any) => decodeHtmlEntities(item.name || '')),
      sortOrder: cat.sort_order
    }))
  } catch (e) {
    return []
  }
}

export async function fetchGroupedSkills(
  supabaseClient?: any
): Promise<SkillCategoryGroup[]> {
  const items = await fetchSkills(supabaseClient)
  if (!items || items.length === 0) return []

  return items.map(item => ({
    id: item.id,
    category: item.category,
    items: item.skills || [],
    sortOrder: item.sortOrder
  }))
}

export async function fetchExperiences(
  supabaseClient?: any
): Promise<ExperienceItem[]> {
  if (!supabaseClient) return []

  try {
    const {data, error} = await supabaseClient
      .from('db_experiences')
      .select('*')
      .order('sort_order', {ascending: true})

    if (error || !data) return []

    return data.map((item: any) => ({
      id: item.id,
      title: decodeHtmlEntities(item.title || ''),
      type: decodeHtmlEntities(item.type || ''),
      company: decodeHtmlEntities(item.company || ''),
      startMonth: formatMonthFull(item.start_month),
      startYear: item.start_year || new Date().getFullYear(),
      endMonth: item.end_month ? formatMonthFull(item.end_month) : null,
      endYear: item.end_year ?? null,
      currentlyIn: item.currently_in ?? false,
      location: decodeHtmlEntities(item.location || ''),
      locType: decodeHtmlEntities(item.loc_type || ''),
      description: decodeHtmlEntities(item.description || ''),
      sortOrder: item.sort_order
    }))
  } catch (e) {
    return []
  }
}

export async function fetchEducation(
  supabaseClient?: any
): Promise<EducationItem[]> {
  if (!supabaseClient) return []

  try {
    const {data, error} = await supabaseClient
      .from('db_educations')
      .select('*')
      .order('sort_order', {ascending: true})

    if (error || !data) return []

    return data.map((item: any) => ({
      id: item.id,
      institution: decodeHtmlEntities(item.institution || ''),
      degree: decodeHtmlEntities(item.degree || ''),
      field: decodeHtmlEntities(item.field || ''),
      startMonth: formatMonthFull(item.start_month),
      startYear: item.start_year || new Date().getFullYear(),
      endMonth: item.end_month ? formatMonthFull(item.end_month) : null,
      endYear: item.end_year ?? null,
      currentlyIn: item.currently_in ?? false,
      grade: decodeHtmlEntities(item.grade || ''),
      description: decodeHtmlEntities(item.description || ''),
      sortOrder: item.sort_order
    }))
  } catch (e) {
    return []
  }
}

export async function fetchCvEntries(
  supabaseClient?: any
): Promise<{experience: ExperienceItem[]; education: EducationItem[]}> {
  const experience = await fetchExperiences(supabaseClient)
  const education = await fetchEducation(supabaseClient)
  return {experience, education}
}

export async function fetchSponsorship(
  supabaseClient?: any
): Promise<SponsorshipLink[]> {
  if (!supabaseClient) return []

  try {
    const {data, error} = await supabaseClient
      .from('db_links')
      .select('*')
      .eq('category', 'funding')
      .order('sort_order', {ascending: true})

    if (error || !data) return []

    return data.map((item: any) => ({
      id: item.id,
      platform: decodeHtmlEntities(item.platform || ''),
      displayValue: decodeHtmlEntities(item.display_value || ''),
      url: decodeHtmlEntities(item.url || ''),
      icon: item.icon || 'bi-currency-dollar',
      description: decodeHtmlEntities(item.description || ''),
      sortOrder: item.sort_order
    }))
  } catch (e) {
    return []
  }
}

export async function fetchFundingLinks(
  supabaseClient?: any
): Promise<SponsorshipLink[]> {
  return fetchSponsorship(supabaseClient)
}

export async function fetchContactInfo(
  supabaseClient?: any
): Promise<ContactInfo[]> {
  if (!supabaseClient) return []

  try {
    const {data, error} = await supabaseClient
      .from('db_links')
      .select('*')
      .eq('category', 'contact')
      .order('sort_order', {ascending: true})

    if (error || !data) return []

    return data.map((item: any) => ({
      id: item.id,
      platform: decodeHtmlEntities(item.platform || item.label || ''),
      displayValue: decodeHtmlEntities(item.display_value || item.value || ''),
      href: decodeHtmlEntities(item.url || item.href || ''),
      icon: item.icon || 'bi-person',
      sortOrder: item.sort_order
    }))
  } catch (e) {
    return []
  }
}

export async function fetchActiveCvDocument(
  supabaseClient?: any,
  fetchFn: typeof fetch = fetch
): Promise<CvDocument | null> {
  if (!supabaseClient) return null

  try {
    const {data, error} = await supabaseClient
      .from('db_documents')
      .select('*')
      .eq('is_active', true)
      .order('sort_order', {ascending: true})
      .limit(1)
      .maybeSingle()

    if (error || !data) {
      return null
    }

    let fullHash = data.hash || ''
    if (fullHash.length < 64 && data.file_url) {
      try {
        const shaRes = await fetchFn(`${data.file_url}.sha256`)
        if (shaRes.ok) {
          const shaText = await shaRes.text()
          const match = shaText.trim().match(/^[a-fA-F0-9]{64}/)
          if (match) {
            fullHash = match[0]
            await supabaseClient
              .from('db_documents')
              .update({hash: fullHash})
              .eq('id', data.id)
          }
        }
      } catch (err) {
        console.error('Error fetching sha256 file:', err)
      }
    }

    return {
      id: data.id,
      filename: data.filename || '',
      fileUrl: data.file_url || '',
      hash: fullHash,
      isActive: data.is_active ?? true,
      sortOrder: data.sort_order,
      updatedAt: data.updated_at
    }
  } catch (e) {
    return null
  }
}
