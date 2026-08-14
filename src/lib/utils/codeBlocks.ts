/** @format */

const LANGUAGE_NAMES: Record<string, string> = {
  js: 'JavaScript',
  javascript: 'JavaScript',
  ts: 'TypeScript',
  typescript: 'TypeScript',
  html: 'HTML',
  css: 'CSS',
  rust: 'Rust',
  rs: 'Rust',
  python: 'Python',
  py: 'Python',
  bash: 'Bash',
  sh: 'Shell',
  shell: 'Shell',
  json: 'JSON',
  yaml: 'YAML',
  yml: 'YAML',
  xml: 'XML',
  md: 'Markdown',
  markdown: 'Markdown',
  go: 'Go',
  golang: 'Go',
  cpp: 'C++',
  c: 'C',
  csharp: 'C#',
  cs: 'C#',
  sql: 'SQL',
  dockerfile: 'Docker',
  docker: 'Docker'
}

export function getPrettyLanguage(className: string): string {
  if (!className) return 'Code'
  const match = className.match(/language-(\S+)/)
  if (!match) return 'Code'
  const lang = match[1].toLowerCase()
  return LANGUAGE_NAMES[lang] || lang.charAt(0).toUpperCase() + lang.slice(1)
}

export function splitHighlightedHtmlLines(html: string): string[] {
  const lines = html.split('\n')
  const result: string[] = []
  let openTags: string[] = []

  for (const line of lines) {
    const prefix = openTags.join('')
    const tagRegex = /<\/?([a-z0-9]+)[^>]*>/gi
    let match: RegExpExecArray | null
    const currentOpen = [...openTags]

    while ((match = tagRegex.exec(line)) !== null) {
      const fullTag = match[0]
      if (fullTag.startsWith('</')) {
        currentOpen.pop()
      } else if (!fullTag.endsWith('/>')) {
        currentOpen.push(fullTag)
      }
    }

    const suffix = currentOpen
      .slice()
      .reverse()
      .map(t => {
        const name = t.match(/<([a-z0-9]+)/i)?.[1]
        return name ? `</${name}>` : ''
      })
      .join('')

    const content = line || '&nbsp;'
    result.push(prefix + content + suffix)
    openTags = currentOpen
  }

  return result
}

export function enhanceCodeBlocks(triggerToast: (message: string) => void) {
  const container = document.querySelector('.prose-custom')
  if (!container) return

  container.querySelectorAll('pre').forEach(el => {
    const pre = el as HTMLElement
    if (pre.dataset.enhanced === 'true') return
    pre.dataset.enhanced = 'true'

    const codeElement = pre.querySelector('code')
    const prettyLang = getPrettyLanguage(codeElement?.className || '')

    const headerBar = document.createElement('div')
    headerBar.className =
      'code-header-bar flex items-center justify-between bg-gh-gray-6 border border-border-subtle rounded-t-sm px-4 py-1.5 text-xs text-text-secondary font-semibold select-none mt-6'

    const leftSpan = document.createElement('span')
    leftSpan.className =
      'text-[12.5px] font-sans font-bold uppercase tracking-wider text-text-secondary leading-none'
    leftSpan.innerText = prettyLang
    headerBar.appendChild(leftSpan)

    const copyBtn = document.createElement('button')
    copyBtn.type = 'button'
    copyBtn.className =
      'flex h-5 w-5 items-center justify-center rounded-sm border border-border-subtle/30 hover:bg-surface-hover/30 hover:text-text-primary transition-colors cursor-pointer text-text-secondary leading-none'
    copyBtn.innerHTML = '<i class="bi bi-copy text-xs" aria-hidden="true"></i>'

    copyBtn.addEventListener('click', () => {
      if (!codeElement) return
      const codeText = codeElement.innerText || codeElement.textContent || ''
      navigator.clipboard
        .writeText(codeText)
        .then(() => {
          triggerToast('Copied!')
        })
        .catch(err => {
          console.error('Failed to copy code: ', err)
        })
    })

    headerBar.appendChild(copyBtn)

    const codeBody = document.createElement('div')
    codeBody.className =
      'code-body flex w-full flex-row items-stretch overflow-hidden rounded-sm border border-border-subtle bg-gh-gray-6'
    codeBody.style.marginTop = '0px'
    codeBody.style.borderTopWidth = '0px'
    codeBody.style.borderTopLeftRadius = '0px'
    codeBody.style.borderTopRightRadius = '0px'

    pre.parentNode?.insertBefore(headerBar, pre)
    headerBar.insertAdjacentElement('afterend', codeBody)

    let gutter: HTMLDivElement | null = null

    if (codeElement) {
      const lines = splitHighlightedHtmlLines(
        codeElement.innerHTML.replace(/\n$/, '')
      )
      codeElement.innerHTML = lines
        .map(line => `<div class="code-line m-0 p-0 pr-3.5">${line}</div>`)
        .join('')

      gutter = document.createElement('div')
      gutter.className =
        'code-line-numbers shrink-0 border-r border-border-subtle/30 bg-gh-gray-5/50 py-2 font-mono text-[0.8rem] leading-relaxed text-text-muted/50 select-none'
      lines.forEach((_, i) => {
        const num = document.createElement('div')
        num.className = 'pr-2 pl-3 text-right'
        num.textContent = String(i + 1)
        gutter?.appendChild(num)
      })
      codeBody.appendChild(gutter)
    }

    pre.style.border = '0'
    pre.style.borderRadius = '0'
    pre.style.background = 'transparent'
    pre.style.margin = '0'
    pre.style.minWidth = '0'
    pre.style.flex = '1 1 0%'

    codeBody.appendChild(pre)

    const syncGutterRowHeights = () => {
      if (!gutter) return
      const codeLineEls = [...pre.querySelectorAll<HTMLElement>('.code-line')]
      const gutterRowEls = [...gutter.children] as HTMLElement[]
      codeLineEls.forEach((lineEl, i) => {
        const rowEl = gutterRowEls[i]
        if (rowEl)
          rowEl.style.height = `${lineEl.getBoundingClientRect().height}px`
      })
    }

    syncGutterRowHeights()
    if (typeof document !== 'undefined' && document.fonts?.ready) {
      document.fonts.ready.then(syncGutterRowHeights)
    }

    const wrapperBar = document.createElement('div')
    wrapperBar.className =
      'code-scrollbar-wrapper flex w-full flex-row items-stretch bg-gh-gray-6 border-x border-b border-border-subtle rounded-b-sm select-none mb-6 overflow-hidden transition-all'

    const gutterSpace = document.createElement('div')
    gutterSpace.className =
      'code-scrollbar-gutter-space shrink-0 bg-gh-gray-5/50 border-r border-border-subtle/30 py-1.5 min-h-[1.25rem] box-border'

    const codeSpace = document.createElement('div')
    codeSpace.className =
      'code-scrollbar-code-space flex flex-1 min-w-0 items-center px-2 py-1.5 bg-gh-gray-6'

    const trackBar = document.createElement('div')
    trackBar.className =
      'code-scrollbar-track relative w-full h-1.5 rounded-full bg-border-subtle/30 cursor-pointer'

    const thumbBar = document.createElement('div')
    thumbBar.className =
      'code-scrollbar-thumb absolute top-0 left-0 h-full rounded-full bg-gh-gray-5 border border-border-subtle/40 shadow-xs transition-[left,width,background-color] duration-75 hover:bg-gh-gray-3 cursor-grab active:cursor-grabbing'

    trackBar.appendChild(thumbBar)
    codeSpace.appendChild(trackBar)
    wrapperBar.appendChild(gutterSpace)
    wrapperBar.appendChild(codeSpace)

    function updateCustomScrollbar() {
      const scrollLeft = pre.scrollLeft
      const scrollWidth = pre.scrollWidth
      const clientWidth = pre.clientWidth

      if (gutter) {
        gutterSpace.style.width = `${gutter.getBoundingClientRect().width}px`
      }

      if (scrollWidth <= clientWidth + 2) {
        wrapperBar.style.display = 'none'
        codeBody.style.borderBottomLeftRadius = '0.25rem'
        codeBody.style.borderBottomRightRadius = '0.25rem'
        codeBody.style.borderBottomWidth = ''
        codeBody.style.marginBottom = '1.5rem'
      } else {
        wrapperBar.style.display = 'flex'
        codeBody.style.borderBottomLeftRadius = '0px'
        codeBody.style.borderBottomRightRadius = '0px'
        codeBody.style.borderBottomWidth = '0px'
        codeBody.style.marginBottom = '0px'

        const thumbRatio = clientWidth / scrollWidth
        const thumbWidthPercent = Math.max(thumbRatio * 100, 12)
        const maxThumbLeft = 100 - thumbWidthPercent
        const maxScroll = scrollWidth - clientWidth
        const thumbLeftPercent =
          maxScroll > 0 ? (scrollLeft / maxScroll) * maxThumbLeft : 0

        thumbBar.style.width = `${thumbWidthPercent}%`
        thumbBar.style.left = `${thumbLeftPercent}%`
      }
    }

    pre.addEventListener('scroll', updateCustomScrollbar, {passive: true})
    window.addEventListener('resize', updateCustomScrollbar)

    trackBar.addEventListener('click', e => {
      if (e.target === thumbBar) return
      const rect = trackBar.getBoundingClientRect()
      const clickRatio = (e.clientX - rect.left) / rect.width
      const maxScroll = pre.scrollWidth - pre.clientWidth
      pre.scrollLeft = clickRatio * maxScroll
    })

    let isDragging = false
    let dragStartX = 0
    let dragStartScrollLeft = 0
    let dragTrackSlack = 0

    thumbBar.addEventListener('mousedown', e => {
      isDragging = true
      dragStartX = e.clientX
      dragStartScrollLeft = pre.scrollLeft
      dragTrackSlack = Math.max(
        trackBar.getBoundingClientRect().width
          - thumbBar.getBoundingClientRect().width,
        1
      )
      thumbBar.style.backgroundColor = 'var(--color-gh-gray-3)'
      document.body.style.userSelect = 'none'
      e.preventDefault()
    })

    window.addEventListener('mousemove', e => {
      if (!isDragging) return
      const maxScroll = pre.scrollWidth - pre.clientWidth
      const deltaX = e.clientX - dragStartX
      const scrollableRatio = maxScroll / dragTrackSlack
      pre.scrollLeft = dragStartScrollLeft + deltaX * scrollableRatio
    })

    window.addEventListener('mouseup', () => {
      if (!isDragging) return
      isDragging = false
      thumbBar.style.backgroundColor = ''
      document.body.style.userSelect = ''
    })

    codeBody.parentNode?.insertBefore(wrapperBar, codeBody.nextSibling)
    setTimeout(updateCustomScrollbar, 50)
  })
}
