/** @format */

export function formatBlogDate(dateStr: string): string {
  if (!dateStr) return ''
  const date = new Date(dateStr)
  if (isNaN(date.getTime())) return ''

  const now = new Date()
  const diffInMs = now.getTime() - date.getTime()
  const diffInSeconds = Math.floor(diffInMs / 1000)
  const diffInMinutes = Math.floor(diffInSeconds / 60)
  const diffInHours = Math.floor(diffInMinutes / 60)
  const diffInDays = Math.floor(diffInHours / 24)

  if (diffInSeconds >= 0 && diffInSeconds < 60) {
    return `${diffInSeconds}s`
  } else if (diffInMinutes >= 1 && diffInMinutes < 60) {
    return `${diffInMinutes}m`
  } else if (diffInHours >= 1 && diffInHours < 24) {
    return `${diffInHours}h`
  } else if (diffInDays >= 1 && diffInDays <= 7) {
    return `${diffInDays}d`
  }

  const monthNames = [
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
  ]
  const fullMonth = monthNames[date.getMonth()]
  const twoDigitDate = String(date.getDate()).padStart(2, '0')
  const year = date.getFullYear()
  const currentYear = now.getFullYear()

  const rawHour = date.getHours()
  const period = rawHour >= 12 ? 'PM' : 'AM'
  const hour12 = rawHour % 12 === 0 ? 12 : rawHour % 12
  const minute = String(date.getMinutes()).padStart(2, '0')

  const yearPart = year === currentYear ? '' : ` ${year}`

  return `${fullMonth} ${twoDigitDate}${yearPart} at ${hour12}:${minute} ${period}`
}

export function formatReadTime(readTimeInput?: string | number | null): string {
  if (!readTimeInput && readTimeInput !== 0) return '1 min read'
  let minutes = 1
  if (typeof readTimeInput === 'number') {
    minutes = Math.max(1, Math.round(readTimeInput))
  } else {
    const matched = readTimeInput.match(/\d+/)
    if (matched) {
      minutes = Math.max(1, parseInt(matched[0], 10))
    }
  }
  return minutes > 1 ? `${minutes} mins read` : `${minutes} min read`
}

export function formatCommentCount(count?: number | null): string {
  const n = count || 0
  return n === 1 ? `${n} comment` : `${n} comments`
}

export function formatViewCount(count?: number | null): string {
  const n = count || 0
  return n === 1 ? `${n} view` : `${n} views`
}
