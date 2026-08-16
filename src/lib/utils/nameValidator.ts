export function normalizeName(name: string): string {
  let normalized = name.trim().toLowerCase().normalize('NFKC')
  normalized = normalized.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  const homoglyphs: Record<string, string> = {
    а: 'a',
    е: 'e',
    о: 'o',
    р: 'p',
    с: 'c',
    у: 'y',
    х: 'x',
    і: 'i',
    ј: 'j',
    ѕ: 's',
    ԁ: 'd',
    ԛ: 'q',
    ԝ: 'w',
    α: 'a',
    ε: 'e',
    ι: 'i',
    ο: 'o',
    ρ: 'p',
    υ: 'y',
    χ: 'x',
    '0': 'o',
    '1': 'i',
    l: 'i'
  }
  let homoglyphFree = ''
  for (const char of normalized) {
    homoglyphFree += homoglyphs[char] || char
  }
  return homoglyphFree.replace(/[^a-z0-9]/g, '')
}

export function isNameReserved(name: string): boolean {
  const normalized = normalizeName(name)

  const substringReserved = [
    'admin',
    'administrator',
    'moderator',
    'owner',
    'support',
    'official',
    'system',
    'farhnkrnapratma',
    'farhankurniapratama',
    'farhan',
    'kurnia',
    'pratama'
  ]

  const exactOrWordReserved = ['mod', 'fkp']

  if (substringReserved.some(pattern => normalized.includes(pattern))) {
    return true
  }

  if (exactOrWordReserved.includes(normalized)) {
    return true
  }

  const words = name
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .map(w => normalizeName(w))
    .filter(Boolean)
  if (words.some(word => exactOrWordReserved.includes(word))) {
    return true
  }

  return false
}
