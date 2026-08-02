/** @format */

import {json} from '@sveltejs/kit'
import {supabase} from '$lib/supabase'
import {
  fetchAuthorProfile,
  fetchCvEntries,
  fetchFundingLinks,
  fetchContactInfo,
  fetchGroupedSkills,
  fetchSocials
} from '$lib/author'

export function sanitizePublicApiData(obj: any): any {
  if (Array.isArray(obj)) {
    const cleanedArr = obj
      .map(item => sanitizePublicApiData(item))
      .filter(item => item !== null && item !== undefined)
    return cleanedArr
  }

  if (obj !== null && typeof obj === 'object') {
    const cleaned: Record<string, any> = {}

    // If end date is present, omit currentlyIn
    const hasEndDate =
      obj.endMonth !== null
      && obj.endMonth !== undefined
      && obj.endYear !== null
      && obj.endYear !== undefined

    for (const [key, value] of Object.entries(obj)) {
      // Omit internal, legacy, or icon/sortOrder fields
      if (
        key === 'id'
        || key === 'authorId'
        || key === 'author_id'
        || key === 'icon'
        || key === 'sortOrder'
        || key === 'sort_order'
        || key === 'firstName'
        || key === 'lastName'
      ) {
        continue
      }

      // Omit currentlyIn if end date is set
      if (hasEndDate && key === 'currentlyIn') {
        continue
      }

      // Omit null or empty description
      if (key === 'description' && (!value || String(value).trim() === '')) {
        continue
      }

      const valCleaned = sanitizePublicApiData(value)

      // Omit empty arrays, null, or empty objects
      if (
        valCleaned === null
        || valCleaned === undefined
        || (Array.isArray(valCleaned) && valCleaned.length === 0)
        || (typeof valCleaned === 'object'
          && !Array.isArray(valCleaned)
          && Object.keys(valCleaned).length === 0)
      ) {
        continue
      }

      cleaned[key] = valCleaned
    }

    return cleaned
  }

  return obj
}

export function generateAuthorMarkdown(data: Record<string, any>): string {
  const lines: string[] = []

  if (data.profile) {
    const p = data.profile
    lines.push(`# ${p.name || 'Author Profile'}`)
    lines.push('')
    if (p.headline) lines.push(`**Headline**: ${p.headline}`)
    if (p.bio) {
      lines.push('')
      lines.push(`> ${p.bio}`)
    }
    lines.push('')
    if (p.city) lines.push(`- **City**: ${p.city}`)
    if (p.postalCode) lines.push(`- **Postal Code**: ${p.postalCode}`)
    if (p.country) lines.push(`- **Country**: ${p.country}`)
    if (p.siteUrl) lines.push(`- **Website**: ${p.siteUrl}`)
    lines.push('')
  }

  if (data.cv && (data.cv.experience?.length || data.cv.education?.length)) {
    if (data.cv.experience && data.cv.experience.length > 0) {
      lines.push('## Work Experience')
      lines.push('')
      data.cv.experience.forEach((exp: any) => {
        const start = `${exp.startMonth || ''} ${exp.startYear || ''}`.trim()
        const end =
          exp.currentlyIn ? 'Present' : (
            `${exp.endMonth || ''} ${exp.endYear || ''}`.trim()
          )
        const locParts = [exp.location, exp.locType ? `(${exp.locType})` : '']
          .filter(Boolean)
          .join(' ')
        const locStr = locParts ? ` | ${locParts}` : ''
        lines.push(`### ${exp.title} — ${exp.company}`)
        lines.push(`*${start} – ${end}${locStr}*`)
        if (exp.description) {
          lines.push('')
          lines.push(exp.description)
        }
        lines.push('')
      })
    }

    if (data.cv.education && data.cv.education.length > 0) {
      lines.push('## Education')
      lines.push('')
      data.cv.education.forEach((edu: any) => {
        const start = `${edu.startMonth || ''} ${edu.startYear || ''}`.trim()
        const end =
          edu.currentlyIn ? 'Present' : (
            `${edu.endMonth || ''} ${edu.endYear || ''}`.trim()
          )
        lines.push(`### ${edu.degree} in ${edu.field} — ${edu.institution}`)
        lines.push(
          `*${start} – ${end}${edu.grade ? ` | GPA: ${edu.grade}` : ''}*`
        )
        if (edu.description) {
          lines.push('')
          lines.push(edu.description)
        }
        lines.push('')
      })
    }
  }

  if (data.skills && data.skills.length > 0) {
    lines.push('## Technical Skills')
    lines.push('')
    data.skills.forEach((cat: any) => {
      const itemsList =
        Array.isArray(cat.items) ? cat.items.join(', ')
        : Array.isArray(cat.skills) ? cat.skills.join(', ')
        : ''
      lines.push(`- **${cat.category}**: ${itemsList}`)
    })
    lines.push('')
  }

  if (data.funding && data.funding.length > 0) {
    lines.push('## Open Source Funding')
    lines.push('')
    data.funding.forEach((f: any) => {
      const title = f.platform || 'Funding'
      const label = f.displayValue || f.platform || f.url
      lines.push(`- **${title}**: [${label}](${f.url})`)
    })
    lines.push('')
  }

  if (data.contact && data.contact.length > 0) {
    lines.push('## Contact Info')
    lines.push('')
    data.contact.forEach((c: any) => {
      const label = c.platform || c.label || 'Contact'
      const value = c.displayValue || c.value || c.href
      const href = c.href || c.url || '#'
      lines.push(`- **${label}**: [${value}](${href})`)
    })
    lines.push('')
  }

  if (data.socials && data.socials.length > 0) {
    lines.push('## Social Media Profiles')
    lines.push('')
    data.socials.forEach((s: any) => {
      lines.push(`- **${s.platform}**: ${s.url}`)
    })
    lines.push('')
  }

  return lines.join('\n')
}

export async function handleAuthorJsonRequest(
  url: URL,
  locals: any,
  request?: Request
) {
  const supabaseClient = locals?.supabase || supabase
  const searchParams = url.searchParams

  const fieldsParam = searchParams.get('fields')
  const requestedFields = new Set<string>()

  if (fieldsParam) {
    fieldsParam
      .split(',')
      .forEach(f => requestedFields.add(f.trim().toLowerCase()))
  }

  const validKeys = [
    'profile',
    'cv',
    'funding',
    'contact',
    'skills',
    'socials',
    'sponsorship'
  ]
  validKeys.forEach(key => {
    if (searchParams.has(key)) {
      requestedFields.add(key === 'sponsorship' ? 'funding' : key)
    }
  })

  const fetchAll = requestedFields.size === 0

  const tasks: Record<string, Promise<any>> = {}

  if (fetchAll || requestedFields.has('profile')) {
    tasks.profile = fetchAuthorProfile(supabaseClient)
  }
  if (fetchAll || requestedFields.has('cv')) {
    tasks.cv = fetchCvEntries(supabaseClient)
  }
  if (fetchAll || requestedFields.has('funding')) {
    tasks.funding = fetchFundingLinks(supabaseClient)
  }
  if (fetchAll || requestedFields.has('contact')) {
    tasks.contact = fetchContactInfo(supabaseClient)
  }
  if (fetchAll || requestedFields.has('skills')) {
    tasks.skills = fetchGroupedSkills(supabaseClient)
  }
  if (fetchAll || requestedFields.has('socials')) {
    tasks.socials = fetchSocials(supabaseClient)
  }

  const keys = Object.keys(tasks)
  const results = await Promise.all(Object.values(tasks))

  const rawData: Record<string, any> = {}
  keys.forEach((key, index) => {
    rawData[key] = results[index]
  })

  const responseData = sanitizePublicApiData(rawData)

  const format = searchParams.get('format')?.toLowerCase()
  const acceptHeader = request?.headers.get('accept')?.toLowerCase() || ''

  const wantsMarkdown =
    format === 'md'
    || format === 'markdown'
    || format === 'text'
    || acceptHeader.includes('text/markdown')
    || acceptHeader.includes('text/x-markdown')

  if (wantsMarkdown) {
    const markdownText = generateAuthorMarkdown(responseData)
    return new Response(markdownText, {
      headers: {
        'Content-Type': 'text/markdown; charset=utf-8',
        'Cache-Control': 'public, max-age=3600, s-maxage=86400',
        'X-Robots-Tag': 'index, follow'
      }
    })
  }

  return json(responseData, {
    headers: {
      'Cache-Control': 'public, max-age=3600, s-maxage=86400',
      'X-Robots-Tag': 'index, follow'
    }
  })
}
