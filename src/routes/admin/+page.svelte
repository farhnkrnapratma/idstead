<!-- @format -->
<script lang="ts">
  import {supabase} from '$lib/supabase'
  import {onMount} from 'svelte'
  import {SvelteSet} from 'svelte/reactivity'
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
    SkipLink,
    FilterToolbar,
    FilterSelect,
    DropdownSelect,
    SortControl,
    SearchResultCount,
    FilterChipGroup,
    FilterEmptyState,
    createFilterSortStore,
    ThemeSelect,
    StatusBanner,
    formatBlogDate,
    formatReadTime,
    formatViewCount
  } from '$lib'
  import {themeStore} from '$lib/stores/themeStore.svelte'
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
  } from '$lib/author'

  interface AdminPost {
    id: string
    title: string
    slug: string
    published: boolean
    storage_path: string
    created_at: string
    banner_path?: string | null
    excerpt?: string | null
    read_time?: string | null
  }

  function getBannerUrl(bannerPath: string | null | undefined): string | null {
    if (!bannerPath) return null
    const {data: res} = supabase.storage
      .from('blog-posts')
      .getPublicUrl(bannerPath)
    return res.publicUrl
  }

  let isLoading = $state(true)
  let posts = $state<AdminPost[]>([])
  let isLoggingOut = $state(false)
  let adminUserEmail = $state('')

  const filterStore = createFilterSortStore({
    defaultSortField: 'date',
    defaultSortDir: 'desc'
  })

  let showDeletePostDialog = $state(false)
  let postToDelete = $state<AdminPost | null>(null)
  let showDeleteCommentDialog = $state(false)
  let commentIdToDelete = $state<string | null>(null)

  interface AdminComment {
    id: string
    post_id: string
    parent_id: string | null
    author_name: string
    content: string
    is_anonymous?: boolean
    is_approved: boolean
    created_at: string
    posts?: {title: string}
  }

  let comments = $state<AdminComment[]>([])
  let replyTo = $state<AdminComment | null>(null)
  let commentContent = $state('')
  let isSubmitting = $state(false)

  let activeAdminTab = $state<
    'posts' | 'author' | 'cv' | 'skills' | 'socials' | 'sponsorship' | 'contact'
  >('posts')
  let sidebarMobileOpen = $state(false)

  type Theme = 'auto' | 'dark' | 'light'

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
  ] as const

  const currentYear = new Date().getFullYear()

  function getStartYearOptions() {
    const years: number[] = []
    for (let y = currentYear; y >= currentYear - 100; y--) {
      years.push(y)
    }
    return years
  }

  function getEndYearOptions(startYear?: number) {
    const start = startYear || currentYear
    const years: number[] = []
    for (let y = start; y <= currentYear + 100; y++) {
      years.push(y)
    }
    return years
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
  ] as const

  const LOCATION_TYPES = ['On-Site', 'Remote', 'Hybrid'] as const

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
  })
  let isSavingAuthor = $state(false)
  let authorSaveSuccess = $state(false)
  let authorSaveError = $state('')

  const authorEmailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  const authorUrlRegex = /^(https?:\/\/|\/)/

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
  })

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
  })

  let authorInitial = $state<typeof authorState | null>(null)

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
  )

  let avatarHasError = $state(false)
  const avatarPreviewUrl = $derived(authorState.avatar.trim())

  $effect(() => {
    void authorState.avatar
    avatarHasError = false
  })

  function debounceAuthor<T extends unknown[]>(
    cb: (...args: T) => void,
    ms: number
  ) {
    let timer: ReturnType<typeof setTimeout>
    return (...args: T) => {
      clearTimeout(timer)
      timer = setTimeout(() => cb(...args), ms)
    }
  }

  const validateAuthorField = debounceAuthor(
    (field: keyof typeof authorErrors) => {
      const v =
        (authorState[field as keyof typeof authorState] as string)?.trim() || ''
      if (field === 'email') {
        if (!v) {
          authorErrors.email = 'Email is required.'
          authorValid.email = false
        } else if (!authorEmailRegex.test(v)) {
          authorErrors.email = 'Please enter a valid email address.'
          authorValid.email = false
        } else {
          authorErrors.email = ''
          authorValid.email = true
        }
      } else if (field === 'avatar' || field === 'siteUrl') {
        if (!v) {
          authorErrors[field] =
            field === 'avatar' ?
              'Avatar URL is required.'
            : 'Site URL is required.'
          authorValid[field] = false
        } else if (!authorUrlRegex.test(v)) {
          authorErrors[field] = 'Must start with http:// or https://'
          authorValid[field] = false
        } else {
          authorErrors[field] = ''
          authorValid[field] = true
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
          }
          authorErrors[field] = `${labels[field] || 'This field'} is required.`
          authorValid[field as keyof typeof authorValid] = false
        } else {
          authorErrors[field] = ''
          authorValid[field as keyof typeof authorValid] = true
        }
      }
    },
    400
  )

  function onAuthorInput(field: keyof typeof authorErrors) {
    authorErrors[field] = ''
    authorValid[field as keyof typeof authorValid] = false
    validateAuthorField(field)
  }

  function validateAllAuthorFields(): boolean {
    const fields = Object.keys(authorErrors) as (keyof typeof authorErrors)[]
    let valid = true
    for (const field of fields) {
      const v =
        (authorState[field as keyof typeof authorState] as string)?.trim() || ''
      if (field === 'email') {
        if (!v || !authorEmailRegex.test(v)) {
          authorErrors[field] =
            !v ? 'Email is required.' : 'Please enter a valid email address.'
          authorValid[field] = false
          valid = false
        } else {
          authorErrors[field] = ''
          authorValid[field] = true
        }
      } else if (field === 'avatar' || field === 'siteUrl') {
        if (!v) {
          authorErrors[field] =
            field === 'avatar' ?
              'Avatar URL is required.'
            : 'Site URL is required.'
          authorValid[field] = false
          valid = false
        } else if (!authorUrlRegex.test(v)) {
          authorErrors[field] = 'Must start with http:// or https://'
          authorValid[field] = false
          valid = false
        } else {
          authorErrors[field] = ''
          authorValid[field] = true
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
          }
          authorErrors[field] = `${labels[field] || 'This field'} is required.`
          authorValid[field as keyof typeof authorValid] = false
          valid = false
        } else {
          authorErrors[field] = ''
          authorValid[field as keyof typeof authorValid] = true
        }
      }
    }
    return valid
  }

  let cvState = $state<{
    experience: ExperienceItem[]
    education: EducationItem[]
  }>({experience: [], education: []})

  let skillsState = $state<SkillItem[]>([])
  let socialState = $state<SocialLink[]>([])
  let sponsorshipState = $state<SponsorshipLink[]>([])
  let contactState = $state<ContactInfo[]>([])
  let cvDocState = $state<CvDocument>({
    filename: '',
    fileUrl: '',
    hash: '',
    isActive: true
  })

  let selectedPdfFile = $state<File | null>(null)
  let isUploadingPdf = $state(false)
  let isDraggingFile = $state(false)
  let pdfUploadError = $state('')
  let pdfUploadSuccess = $state('')
  let copiedCvHash = $state(false)

  function handleFileDrop(e: DragEvent) {
    e.preventDefault()
    isDraggingFile = false
    if (e.dataTransfer?.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0]
      if (
        file.type === 'application/pdf'
        || file.name.toLowerCase().endsWith('.pdf')
      ) {
        if (file.size > 10 * 1024 * 1024) {
          pdfUploadError = 'File size exceeds 10 MB limit.'
          selectedPdfFile = null
          return
        }
        selectedPdfFile = file
        pdfUploadError = ''
      } else {
        pdfUploadError = 'Only PDF files are supported.'
        selectedPdfFile = null
      }
    }
  }

  let isSavingCv = $state(false)
  let cvSaveSuccess = $state(false)
  let isSavingSkills = $state(false)
  let skillsSaveSuccess = $state(false)
  let isSavingSocials = $state(false)
  let socialsSaveSuccess = $state(false)
  let isSavingSponsorship = $state(false)
  let sponsorshipSaveSuccess = $state(false)
  let isSavingContact = $state(false)
  let contactSaveSuccess = $state(false)

  let editingSkillKey = $state<string | null>(null)
  let editingSkillText = $state<string>('')
  let draggedSkillIdx = $state<number | null>(null)

  function startEditSkill(
    catIdx: number,
    skillIdx: number,
    currentText: string
  ) {
    editingSkillKey = `${catIdx}-${skillIdx}`
    editingSkillText = currentText
  }

  function saveEditSkill(catIdx: number, skillIdx: number) {
    if (editingSkillKey === `${catIdx}-${skillIdx}`) {
      const trimmed = editingSkillText.trim().replace(/,/g, '')
      if (trimmed) {
        skillsState[catIdx].skills[skillIdx] = trimmed
      }
      editingSkillKey = null
      editingSkillText = ''
    }
  }

  function handleSkillDragStart(sIdx: number, e: DragEvent) {
    draggedSkillIdx = sIdx
    if (e.dataTransfer) {
      e.dataTransfer.effectAllowed = 'move'
      e.dataTransfer.setData('text/plain', String(sIdx))
    }
  }

  function handleSkillDrop(catIdx: number, targetIdx: number, e: DragEvent) {
    e.preventDefault()
    if (draggedSkillIdx !== null && draggedSkillIdx !== targetIdx) {
      const skills = [...skillsState[catIdx].skills]
      const [removed] = skills.splice(draggedSkillIdx, 1)
      skills.splice(targetIdx, 0, removed)
      skillsState[catIdx].skills = skills
    }
    draggedSkillIdx = null
  }

  const statusFilter = $derived(filterStore.filters['status']?.[0] || 'all')

  const postViewsMap = $state(new Map<string, number>())

  async function fetchPostViews(postId: string) {
    if (postViewsMap.has(postId)) return
    try {
      const res = await fetch(`/api/views?post_id=${postId}`)
      if (res.ok) {
        const data = await res.json()
        postViewsMap.set(postId, data.views || 0)
      }
    } catch (err) {
      console.error('Failed to fetch views for post:', postId, err)
    }
  }

  $effect(() => {
    if (posts.length > 0) {
      posts.forEach(post => fetchPostViews(post.id))
    }
  })

  function getPostComments(postId: string): AdminComment[] {
    return comments.filter(c => c.post_id === postId)
  }

  let filteredPosts = $derived.by(() => {
    let result = [...posts]

    if (filterStore.search.trim()) {
      const q = filterStore.search.toLowerCase().trim()
      result = result.filter(
        p =>
          p.title.toLowerCase().includes(q)
          || p.slug.toLowerCase().includes(q)
          || (p.excerpt && p.excerpt.toLowerCase().includes(q))
      )
    }

    if (statusFilter === 'published') {
      result = result.filter(p => p.published)
    } else if (statusFilter === 'draft') {
      result = result.filter(p => !p.published)
    }

    const {field, direction} = filterStore.sort
    const mult = direction === 'asc' ? 1 : -1

    result.sort((a, b) => {
      if (field === 'date') {
        return (
          mult
          * (new Date(a.created_at).getTime()
            - new Date(b.created_at).getTime())
        )
      }
      if (field === 'title') {
        return mult * a.title.localeCompare(b.title)
      }
      if (field === 'status') {
        return mult * (Number(a.published) - Number(b.published))
      }
      if (field === 'views') {
        const vA = postViewsMap.get(a.id) ?? 0
        const vB = postViewsMap.get(b.id) ?? 0
        return mult * (vA - vB)
      }
      if (field === 'comments') {
        const cA = getPostComments(a.id).length
        const cB = getPostComments(b.id).length
        return mult * (cA - cB)
      }
      if (field === 'readingTime') {
        const rA = parseInt(a.read_time || '0', 10)
        const rB = parseInt(b.read_time || '0', 10)
        return mult * (rA - rB)
      }
      return 0
    })

    return result
  })

  const expandedPostIds = new SvelteSet<string>()

  function toggleComments(postId: string) {
    if (expandedPostIds.has(postId)) {
      expandedPostIds.delete(postId)
    } else {
      expandedPostIds.add(postId)
    }
  }

  function sanitizeInput(text: string): string {
    if (!text) return ''
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#x27;')
      .replace(/\//g, '&#x2F;')
  }

  function getCommentIcon(comment: AdminComment): string {
    if (
      comment.author_name === 'Admin'
      || (comment.author_name
        && comment.author_name.toLowerCase().includes('farhan'))
    ) {
      return 'admin_panel_settings'
    }
    return comment.is_anonymous ? 'account_circle' : 'person'
  }

  async function handleAdminSubmit(
    e: SubmitEvent,
    parentId: string,
    postId: string
  ) {
    e.preventDefault()
    if (isSubmitting) return

    const trimmed = commentContent.trim()
    if (!trimmed) return

    isSubmitting = true
    try {
      const {data, error} = await supabase
        .from('comments')
        .insert({
          post_id: postId,
          parent_id: parentId,
          author_name: 'Admin',
          content: sanitizeInput(trimmed),
          is_anonymous: false,
          is_approved: true
        })
        .select('*')
        .single()

      if (error) throw error

      if (data) {
        const postObj = posts.find(p => p.id === postId)
        const newComment: AdminComment = {
          ...data,
          posts: {title: postObj?.title || ''}
        }
        comments = [...comments, newComment]
        commentContent = ''
        replyTo = null
      }
    } catch (err) {
      console.error('Error posting admin reply:', err)
    } finally {
      isSubmitting = false
    }
  }

  let sessionTimeoutMultiplier = $state(1)
  let BASE_IDLE_TIMEOUT_MS = 30 * 60 * 1000 // 30 minutes
  let idleWarnTimer: ReturnType<typeof setTimeout>
  let showSessionTimeoutDialog = $state(false)
  let countdownSeconds = $state(30)
  let countdownInterval: ReturnType<typeof setInterval>

  function startIdleTimer() {
    clearTimeout(idleWarnTimer)
    clearInterval(countdownInterval)
    const warnMs = BASE_IDLE_TIMEOUT_MS * sessionTimeoutMultiplier - 30000

    idleWarnTimer = setTimeout(() => {
      showSessionTimeoutDialog = true
      countdownSeconds = 30
      countdownInterval = setInterval(() => {
        countdownSeconds -= 1
        if (countdownSeconds <= 0) {
          clearInterval(countdownInterval)
          handleLogout()
        }
      }, 1000)
    }, warnMs)
  }

  async function handleExtendSession() {
    sessionTimeoutMultiplier *= 2
    showSessionTimeoutDialog = false
    clearInterval(countdownInterval)
    try {
      await supabase.auth.refreshSession()
    } catch (err) {
      console.error('Failed to refresh session:', err)
    }
    startIdleTimer()
  }

  const ACTIVITY_EVENTS = [
    'mousemove',
    'mousedown',
    'keydown',
    'scroll',
    'touchstart'
  ] as const

  function handleUserActivity() {
    if (!showSessionTimeoutDialog) {
      startIdleTimer()
    }
  }

  onMount(() => {
    ;(async () => {
      const {data: sessionData} = await supabase.auth.getSession()
      if (!sessionData.session) {
        window.location.href = '/admin/login'
        return
      }

      if (sessionData.session.user?.email) {
        adminUserEmail = sessionData.session.user.email
      }

      startIdleTimer()
      ACTIVITY_EVENTS.forEach(evt =>
        window.addEventListener(evt, handleUserActivity, {passive: true})
      )

      await Promise.all([fetchPosts(), fetchComments(), loadAdminData()])
      isLoading = false
    })()

    return () => {
      clearTimeout(idleWarnTimer)
      clearInterval(countdownInterval)
      if (typeof window !== 'undefined') {
        ACTIVITY_EVENTS.forEach(evt =>
          window.removeEventListener(evt, handleUserActivity)
        )
      }
    }
  })

  async function loadAdminData() {
    try {
      const [p, cv, sp, ct, soc, sk, doc] = await Promise.all([
        fetchAuthorProfile(supabase),
        fetchCvEntries(supabase),
        fetchSponsorship(supabase),
        fetchContactInfo(supabase),
        fetchSocials(supabase),
        fetchSkills(supabase),
        fetchActiveCvDocument(supabase)
      ])
      if (p) authorState = p
      authorInitial = {...authorState}
      if (cv) cvState = cv
      if (sp) sponsorshipState = sp
      if (ct) contactState = ct
      if (soc) socialState = soc
      if (sk) skillsState = sk
      cvDocState = doc || {filename: '', fileUrl: '', hash: '', isActive: false}
    } catch (err) {
      console.error('Failed to load admin supplementary data:', err)
    }
  }

  async function fetchPosts() {
    try {
      const {data, error} = await supabase
        .from('posts')
        .select(
          'id, title, slug, published, storage_path, created_at, banner_path, excerpt'
        )
        .order('created_at', {ascending: false})

      if (error) throw error

      const postsWithReadTime = await Promise.all(
        (data || []).map(async post => {
          let readTime = '1 min read'
          if (post.storage_path) {
            try {
              const {data: urlData} = supabase.storage
                .from('blog-posts')
                .getPublicUrl(post.storage_path)
              const fileRes = await fetch(urlData.publicUrl)
              if (fileRes.ok) {
                const text = await fileRes.text()
                const words = text.trim().split(/\s+/).filter(Boolean).length
                const minutes = Math.max(1, Math.ceil(words / 200))
                readTime = `${minutes} min${minutes > 1 ? 's' : ''} read`
              }
            } catch (err) {
              console.error('Error fetching post content for read_time:', err)
            }
          }
          return {...post, read_time: readTime}
        })
      )

      posts = postsWithReadTime
    } catch (err) {
      console.error('Error fetching admin posts:', err)
    }
  }

  async function fetchComments() {
    try {
      const {data, error} = await supabase
        .from('comments')
        .select('*, posts:post_id(title)')
        .order('created_at', {ascending: false})

      if (error) throw error
      comments = (data as any) || []
    } catch (err) {
      console.error('Error fetching admin comments:', err)
    }
  }

  async function handleLogout() {
    isLoggingOut = true
    try {
      await supabase.auth.signOut()
      window.location.href = '/admin/login'
    } catch (err) {
      console.error('Error signing out:', err)
      isLoggingOut = false
    }
  }

  async function handleTogglePublished(post: AdminPost) {
    try {
      const nextPublished = !post.published
      const {error} = await supabase
        .from('posts')
        .update({published: nextPublished})
        .eq('id', post.id)

      if (error) throw error
      posts = posts.map(p =>
        p.id === post.id ? {...p, published: nextPublished} : p
      )
    } catch (err) {
      console.error('Error updating post published status:', err)
    }
  }

  function confirmDeletePost(post: AdminPost) {
    postToDelete = post
    showDeletePostDialog = true
  }

  async function executeDeletePost() {
    if (!postToDelete) return
    try {
      if (postToDelete.storage_path) {
        await supabase.storage
          .from('blog-posts')
          .remove([postToDelete.storage_path])
      }
      if (postToDelete.banner_path) {
        await supabase.storage
          .from('blog-posts')
          .remove([postToDelete.banner_path])
      }
      const {error} = await supabase
        .from('posts')
        .delete()
        .eq('id', postToDelete.id)
      if (error) throw error
      posts = posts.filter(p => p.id !== postToDelete!.id)
    } catch (err) {
      console.error('Error deleting post:', err)
    } finally {
      showDeletePostDialog = false
      postToDelete = null
    }
  }

  function confirmDeleteComment(id: string) {
    commentIdToDelete = id
    showDeleteCommentDialog = true
  }

  function getCommentDescendantIds(
    targetId: string,
    allComments: AdminComment[]
  ): string[] {
    const ids = new SvelteSet<string>([targetId])
    let prevSize = 0
    while (ids.size > prevSize) {
      prevSize = ids.size
      for (const c of allComments) {
        if (c.parent_id && ids.has(c.parent_id)) {
          ids.add(c.id)
        }
      }
    }
    return Array.from(ids)
  }

  async function executeDeleteComment() {
    if (!commentIdToDelete) return
    try {
      const idsToDelete = getCommentDescendantIds(commentIdToDelete, comments)

      const {error} = await supabase
        .from('comments')
        .delete()
        .in('id', idsToDelete)
      if (error) throw error

      comments = comments.filter(c => !idsToDelete.includes(c.id))
    } catch (err) {
      console.error('Error deleting comment:', err)
    } finally {
      showDeleteCommentDialog = false
      commentIdToDelete = null
    }
  }

  async function toggleCommentApproval(comment: AdminComment) {
    try {
      const nextApproved = !comment.is_approved
      const {error} = await supabase
        .from('comments')
        .update({is_approved: nextApproved})
        .eq('id', comment.id)

      if (error) throw error
      comments = comments.map(c =>
        c.id === comment.id ? {...c, is_approved: nextApproved} : c
      )
    } catch (err) {
      console.error('Error toggling comment approval:', err)
    }
  }

  function moveArrayItem<T>(
    arr: T[],
    fromIndex: number,
    direction: 'up' | 'down'
  ): T[] {
    const toIndex = direction === 'up' ? fromIndex - 1 : fromIndex + 1
    if (toIndex < 0 || toIndex >= arr.length) return arr
    const updated = [...arr]
    const [moved] = updated.splice(fromIndex, 1)
    updated.splice(toIndex, 0, moved)
    return updated
  }

  async function handleSaveAuthor(e: SubmitEvent) {
    e.preventDefault()
    if (isSavingAuthor) return
    if (!validateAllAuthorFields()) return
    isSavingAuthor = true
    authorSaveSuccess = false
    authorSaveError = ''
    try {
      let cleanUsername = authorState.username.trim()
      if (cleanUsername.startsWith('@')) {
        cleanUsername = cleanUsername.replace(/^@+/, '')
      }
      cleanUsername = cleanUsername.replace(/\s+/g, '')

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
      }

      if (authorState.id) {
        const {data, error} = await supabase
          .from('author_profile')
          .update(payload)
          .eq('id', authorState.id)
          .select()
        if (error) throw error

        if (!data || data.length === 0) {
          const {data: existingRows} = await supabase
            .from('author_profile')
            .select('id')
            .limit(1)
          if (existingRows && existingRows.length > 0) {
            const realId = existingRows[0].id
            authorState.id = realId
            const {data: updated2, error: err2} = await supabase
              .from('author_profile')
              .update(payload)
              .eq('id', realId)
              .select()
            if (err2) throw err2
            if (!updated2 || updated2.length === 0) {
              throw new Error('Could not update author profile record.')
            }
          } else {
            const {data: inserted, error: err3} = await supabase
              .from('author_profile')
              .insert(payload)
              .select()
              .single()
            if (err3) throw err3
            if (inserted) authorState.id = inserted.id
          }
        }
      } else {
        const {data: existingRows} = await supabase
          .from('author_profile')
          .select('id')
          .limit(1)
        if (existingRows && existingRows.length > 0) {
          const realId = existingRows[0].id
          authorState.id = realId
          const {data: updated, error: err4} = await supabase
            .from('author_profile')
            .update(payload)
            .eq('id', realId)
            .select()
          if (err4) throw err4
        } else {
          const {data: inserted, error: err5} = await supabase
            .from('author_profile')
            .insert(payload)
            .select()
            .single()
          if (err5) throw err5
          if (inserted) authorState.id = inserted.id
        }
      }

      authorState.username = cleanUsername
      authorSaveSuccess = true
      authorInitial = {...authorState}
      setTimeout(() => (authorSaveSuccess = false), 2500)
    } catch (err: any) {
      console.error('Error saving author profile:', err)
      authorSaveError = err.message || 'Failed to save author profile.'
    } finally {
      isSavingAuthor = false
    }
  }

  async function handleSaveCv(e: SubmitEvent) {
    e.preventDefault()
    if (isSavingCv) return
    isSavingCv = true
    cvSaveSuccess = false
    try {
      await supabase
        .from('experiences')
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000')
      await supabase
        .from('education')
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000')

      if (cvState.experience.length > 0) {
        const expPayload = cvState.experience.map((item, idx) => ({
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
        }))
        const {error: expErr} = await supabase
          .from('experiences')
          .insert(expPayload)
        if (expErr) throw expErr
      }

      if (cvState.education.length > 0) {
        const eduPayload = cvState.education.map((item, idx) => ({
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
        }))
        const {error: eduErr} = await supabase
          .from('education')
          .insert(eduPayload)
        if (eduErr) throw eduErr
      }

      cvSaveSuccess = true
      setTimeout(() => (cvSaveSuccess = false), 2500)
    } catch (err) {
      console.error('Error saving CV entries:', err)
    } finally {
      isSavingCv = false
    }
  }

  async function handleSaveSkills(e: SubmitEvent) {
    e.preventDefault()
    if (isSavingSkills) return
    isSavingSkills = true
    skillsSaveSuccess = false
    try {
      await supabase
        .from('skills')
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000')

      if (skillsState.length > 0) {
        const payload = skillsState.map((item, idx) => ({
          category: sanitizeInput(item.category.trim()),
          skills:
            Array.isArray(item.skills) ?
              item.skills.map(s => sanitizeInput(s.trim())).filter(Boolean)
            : [],
          sort_order: idx + 1
        }))
        const {error} = await supabase.from('skills').insert(payload)
        if (error) throw error
      }

      skillsSaveSuccess = true
      setTimeout(() => (skillsSaveSuccess = false), 2500)
    } catch (err) {
      console.error('Error saving skills:', err)
    } finally {
      isSavingSkills = false
    }
  }

  async function handleSaveSocials(e: SubmitEvent) {
    e.preventDefault()
    if (isSavingSocials) return
    isSavingSocials = true
    socialsSaveSuccess = false
    try {
      await supabase
        .from('socials')
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000')

      if (socialState.length > 0) {
        const payload = socialState.map((item, idx) => ({
          platform: sanitizeInput(item.platform.trim()),
          url: item.url.trim(),
          icon: sanitizeIconClass(item.icon, 'bi-people'),
          sort_order: idx + 1
        }))
        const {error} = await supabase.from('socials').insert(payload)
        if (error) throw error
      }

      socialsSaveSuccess = true
      setTimeout(() => (socialsSaveSuccess = false), 2500)
    } catch (err) {
      console.error('Error saving socials:', err)
    } finally {
      isSavingSocials = false
    }
  }

  async function handleSaveSponsorship(e: SubmitEvent) {
    e.preventDefault()
    if (isSavingSponsorship) return
    isSavingSponsorship = true
    sponsorshipSaveSuccess = false
    try {
      await supabase
        .from('funding')
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000')

      if (sponsorshipState.length > 0) {
        const payload = sponsorshipState.map((item, idx) => ({
          platform: sanitizeInput(item.platform.trim()),
          display_value: sanitizeInput(item.displayValue.trim()),
          url: item.url.trim(),
          icon: sanitizeIconClass(item.icon, 'bi-currency-dollar'),
          description: sanitizeInput(item.description.trim()),
          sort_order: idx + 1
        }))
        const {error} = await supabase.from('funding').insert(payload)
        if (error) throw error
      }

      sponsorshipSaveSuccess = true
      setTimeout(() => (sponsorshipSaveSuccess = false), 2500)
    } catch (err) {
      console.error('Error saving sponsorship links:', err)
    } finally {
      isSavingSponsorship = false
    }
  }

  async function handleSaveContact(e: SubmitEvent) {
    e.preventDefault()
    if (isSavingContact) return
    isSavingContact = true
    contactSaveSuccess = false
    try {
      await supabase
        .from('contact_info')
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000')

      if (contactState.length > 0) {
        const payload = contactState.map((item, idx) => ({
          platform: sanitizeInput(item.platform.trim()),
          display_value: sanitizeInput(item.displayValue.trim()),
          href: item.href.trim(),
          icon: sanitizeIconClass(item.icon, 'bi-person'),
          sort_order: idx + 1
        }))
        const {error} = await supabase.from('contact_info').insert(payload)
        if (error) throw error
      }

      contactSaveSuccess = true
      setTimeout(() => (contactSaveSuccess = false), 2500)
    } catch (err) {
      console.error('Error saving contact info:', err)
    } finally {
      isSavingContact = false
    }
  }

  async function handleUploadPdf(e: SubmitEvent) {
    e.preventDefault()
    if (!selectedPdfFile || isUploadingPdf) return

    isUploadingPdf = true
    pdfUploadError = ''
    pdfUploadSuccess = ''

    try {
      const {data: sessionData} = await supabase.auth.getSession()
      const accessToken = sessionData.session?.access_token
      if (!accessToken) {
        throw new Error('Your admin session has expired. Please log in again.')
      }

      const formData = new FormData()
      formData.append('file', selectedPdfFile)

      const response = await fetch('/api/admin/cv/upload', {
        method: 'POST',
        headers: {Authorization: `Bearer ${accessToken}`},
        body: formData
      })

      const res = await response.json()
      if (!response.ok || !res.success) {
        throw new Error(res.error || 'Failed to upload PDF file')
      }

      cvDocState = {
        filename: res.filename,
        fileUrl: res.fileUrl,
        hash: res.hash,
        isActive: true
      }

      pdfUploadSuccess = `Successfully uploaded ${res.filename} to R2 & synced database!`
      selectedPdfFile = null

      const fileInput = document.getElementById(
        'cv-pdf-upload'
      ) as HTMLInputElement
      if (fileInput) fileInput.value = ''
    } catch (err: any) {
      console.error('PDF upload error:', err)
      pdfUploadError = err.message || 'Failed to upload PDF'
    } finally {
      isUploadingPdf = false
    }
  }

  async function handleDeleteCvDoc() {
    if (!cvDocState.filename) return
    if (
      !confirm(
        `Delete CV document "${cvDocState.filename}" from CDN & database?`
      )
    )
      return

    try {
      const {data: sessionData} = await supabase.auth.getSession()
      const accessToken = sessionData.session?.access_token
      if (!accessToken) {
        throw new Error('Your admin session has expired. Please log in again.')
      }

      const response = await fetch('/api/admin/cv/delete', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`
        },
        body: JSON.stringify({filename: cvDocState.filename})
      })

      if (response.ok) {
        cvDocState = {filename: '', fileUrl: '', hash: '', isActive: false}
        pdfUploadSuccess = 'CV document deleted successfully.'
        setTimeout(() => (pdfUploadSuccess = ''), 3000)
      }
    } catch (err) {
      console.error('Failed to delete CV document:', err)
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
          startYear: currentYear,
          endMonth: null,
          endYear: null,
          currentlyIn: false,
          location: '',
          locType: '',
          description: ''
        }
      ]
    } else {
      cvState.education = [
        ...cvState.education,
        {
          institution: '',
          degree: '',
          field: '',
          startMonth: '',
          startYear: currentYear,
          endMonth: null,
          endYear: null,
          currentlyIn: false,
          grade: '',
          description: ''
        }
      ]
    }
  }

  function handleRemoveCvEntry(type: 'experience' | 'education', idx: number) {
    if (type === 'experience') {
      cvState.experience = cvState.experience.filter((_, i) => i !== idx)
    } else {
      cvState.education = cvState.education.filter((_, i) => i !== idx)
    }
  }

  function handleAddSkill() {
    skillsState = [...skillsState, {category: '', skills: []}]
  }

  function handleRemoveSkill(idx: number) {
    skillsState = skillsState.filter((_, i) => i !== idx)
  }

  function handleAddSocial() {
    socialState = [...socialState, {platform: '', url: '', icon: ''}]
  }

  function handleRemoveSocial(idx: number) {
    socialState = socialState.filter((_, i) => i !== idx)
  }

  function handleAddSponsorship() {
    sponsorshipState = [
      ...sponsorshipState,
      {platform: '', displayValue: '', url: '', icon: '', description: ''}
    ]
  }

  function handleRemoveSponsorship(idx: number) {
    sponsorshipState = sponsorshipState.filter((_, i) => i !== idx)
  }

  function handleAddContact() {
    contactState = [
      ...contactState,
      {platform: '', displayValue: '', href: '', icon: ''}
    ]
  }

  function handleRemoveContact(idx: number) {
    contactState = contactState.filter((_, i) => i !== idx)
  }

  const adminNavLinks: {
    id: typeof activeAdminTab
    label: string
    icon: string
    section: 'content' | 'profile'
  }[] = [
    {
      id: 'posts',
      label: 'Blog Posts',
      icon: 'bi-body-text',
      section: 'content'
    },
    {
      id: 'author',
      label: 'Author Profile',
      icon: 'bi-person-lines-fill',
      section: 'profile'
    },
    {
      id: 'cv',
      label: 'CV Entries',
      icon: 'bi-list-columns-reverse',
      section: 'profile'
    },
    {id: 'skills', label: 'Skills', icon: 'bi-stack', section: 'profile'},
    {
      id: 'socials',
      label: 'Social Links',
      icon: 'bi-globe-americas',
      section: 'profile'
    },
    {
      id: 'sponsorship',
      label: 'Sponsorship',
      icon: 'bi-heart-fill',
      section: 'profile'
    },
    {
      id: 'contact',
      label: 'Contact Info',
      icon: 'bi-envelope-at-fill',
      section: 'profile'
    }
  ]
</script>

<svelte:head>
  <title>Admin Console</title>
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
          type="button"
          variant="destructive"
          size="md"
          onclick={handleLogout}
          disabled={isLoggingOut}>
          Sign out
        </Button>
        <Button
          type="button"
          variant="primary"
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
    <button
      type="button"
      onclick={() => (sidebarMobileOpen = !sidebarMobileOpen)}
      class="flex h-9 w-9 items-center justify-center rounded-md border border-border-subtle text-text-primary hover:bg-surface-hover"
      aria-expanded={sidebarMobileOpen}
      aria-label={sidebarMobileOpen ? 'Close sidebar' : 'Open sidebar'}
      title={sidebarMobileOpen ? 'Close sidebar' : 'Open sidebar'}>
      <i class="bi {sidebarMobileOpen ? 'bi-x-lg' : 'bi-list'} text-lg"></i>
    </button>
    <span class="text-base font-bold text-text-primary">Admin Console</span>
  </div>
  <ThemeSelect
    theme={themeStore.current}
    onThemeChange={themeStore.apply} />
</div>

<div class="flex min-h-screen pt-14 md:pt-0">
  <aside
    class="fixed inset-y-0 left-0 z-50 flex w-64 shrink-0 flex-col justify-between overflow-y-auto border-r border-border-subtle bg-surface-card transition-transform duration-200 ease-in-out md:sticky md:top-0 md:h-screen md:w-72 md:translate-x-0 {(
      sidebarMobileOpen
    ) ?
      'translate-x-0 shadow-2xl'
    : '-translate-x-full'}">
    <div
      class="flex items-center justify-between border-b border-border-subtle/60 p-4">
      <h1 class="text-base font-bold tracking-tight text-text-primary">
        Admin Console
      </h1>
      <ThemeSelect
        theme={themeStore.current}
        onThemeChange={themeStore.apply} />
    </div>

    <nav
      class="flex flex-1 flex-col p-3 font-sans"
      aria-label="Admin Navigation">
      <div
        class="px-2 pb-1.5 text-[11px] font-bold tracking-wider text-text-primary uppercase select-none">
        Content Management
      </div>
      <div class="flex flex-col gap-1">
        {#each adminNavLinks.filter(l => l.section === 'content') as link (link.id)}
          <button
            type="button"
            onclick={() => {
              activeAdminTab = link.id
              sidebarMobileOpen = false
            }}
            class="group flex h-10 w-full items-center gap-3 rounded-md px-3 text-left text-xs font-bold transition-all duration-150 ease-in-out {(
              activeAdminTab === link.id
            ) ?
              'border-l-3 border-copilot bg-copilot-subtle font-extrabold text-copilot shadow-xs'
            : 'border-l-3 border-transparent text-text-primary hover:bg-surface-hover hover:text-copilot'}">
            <i class="bi {link.icon} text-base transition-colors"></i>
            <span>{link.label}</span>
          </button>
        {/each}
      </div>

      <div
        class="mt-5 border-t border-border-subtle/40 px-2 pt-4 pb-1.5 text-[11px] font-bold tracking-wider text-text-primary uppercase select-none">
        Profile & Resume
      </div>
      <div class="flex flex-col gap-1">
        {#each adminNavLinks.filter(l => l.section === 'profile') as link (link.id)}
          <button
            type="button"
            onclick={() => {
              activeAdminTab = link.id
              sidebarMobileOpen = false
            }}
            class="group flex h-10 w-full items-center gap-3 rounded-md px-3 text-left text-xs font-bold transition-all duration-150 ease-in-out {(
              activeAdminTab === link.id
            ) ?
              'border-l-3 border-copilot bg-copilot-subtle font-extrabold text-copilot shadow-xs'
            : 'border-l-3 border-transparent text-text-primary hover:bg-surface-hover hover:text-copilot'}">
            <i class="bi {link.icon} text-base transition-colors"></i>
            <span>{link.label}</span>
          </button>
        {/each}
      </div>
    </nav>

    <div
      class="sticky bottom-0 z-10 mt-auto border-t border-border-subtle/60 bg-surface-card p-4">
      <div class="flex items-center justify-between gap-2">
        <div class="flex min-w-0 items-center gap-2.5">
          <span class="bi bi-person-circle shrink-0 text-2xl"></span>
          <div class="flex flex-col truncate">
            <span class="text-xs leading-tight font-bold text-text-primary"
              >Admin</span>
            <span
              class="truncate font-mono text-[11px] leading-tight font-normal text-text-primary"
              title={adminUserEmail || authorState.email}>
              {adminUserEmail || authorState.email || 'admin@fkp.my.id'}
            </span>
          </div>
        </div>

        <Button
          variant="secondary"
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
      class="fixed inset-0 z-40 bg-overlay/50 backdrop-blur-xs md:hidden"
      onclick={() => (sidebarMobileOpen = false)}
      aria-label="Close sidebar"></button>
  {/if}

  <main
    id="main-content"
    class="flex-1 overflow-y-auto p-6 pb-32 font-sans">
    {#if isLoading}
      <LoadingState
        label="Loading dashboard data..."
        size="lg"
        class="py-20" />
    {:else if activeAdminTab === 'posts'}
      <div class="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 class="text-2xl font-bold tracking-tight text-text-primary">
            Blog Posts
          </h1>
          <p class="mt-1 text-xs text-text-secondary">
            Manage articles and post comments
          </p>
        </div>
        <a
          href="/admin/new"
          class="inline-flex cursor-pointer items-center justify-center rounded-md bg-copilot px-4 py-2 text-sm font-semibold text-white shadow-xs transition-all"
          >+ New Post</a>
      </div>

      <div
        class="mb-6 flex flex-col gap-4 rounded-xl border border-border-subtle bg-surface-card/40 p-4 shadow-xs">
        <div
          class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div
            class="flex w-full items-center gap-3 sm:w-auto sm:max-w-md sm:flex-1">
            <Input
              type="search"
              placeholder="Search posts..."
              value={filterStore.search}
              oninput={e =>
                filterStore.setSearch((e.target as HTMLInputElement).value)}
              size="sm"
              aria-label="Search blog posts" />
          </div>
          <SearchResultCount
            count={filteredPosts.length}
            total={posts.length}
            itemLabel="posts" />
        </div>

        <div
          class="flex flex-wrap items-center justify-between gap-4 border-t border-border-subtle/50 pt-3">
          <FilterSelect
            label="Status"
            value={statusFilter}
            options={[
              {value: 'all', label: 'All Status'},
              {value: 'published', label: 'Published'},
              {value: 'draft', label: 'Draft'}
            ]}
            onChange={val => filterStore.setSingleFilter('status', val)} />
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
        </div>
      </div>

      {#if filteredPosts.length === 0}
        <EmptyState
          title="No posts found"
          description="Try adjusting your filter or search query." />
      {:else}
        <div class="grid grid-cols-1 items-start gap-4 md:grid-cols-2">
          {#each filteredPosts as post (post.id)}
            <div
              class="group relative flex w-full flex-col gap-3 rounded-xl border border-border-subtle bg-surface-card p-5 shadow-xs transition-all duration-200 hover:bg-surface-hover/40">
              <div
                class="relative aspect-video w-full overflow-hidden rounded-lg border border-border-subtle select-none">
                {#if post.banner_path}
                  <img
                    src={getBannerUrl(post.banner_path)}
                    alt={post.title}
                    loading="lazy"
                    class="block h-full w-full object-cover transition-transform duration-300 group-hover:scale-103" />
                {:else}
                  <div
                    class="to-palette-purple/15 flex h-full w-full items-center justify-center bg-linear-to-br from-copilot/15 select-none">
                    <i
                      class="bi bi-body-text text-2xl text-copilot/50"
                      aria-hidden="true"></i>
                  </div>
                {/if}
              </div>

              <div
                class="no-scrollbar flex w-full flex-wrap items-center gap-x-2 gap-y-1 text-xs font-semibold text-text-secondary select-none">
                <Badge variant={post.published ? 'success' : 'warning'}>
                  {post.published ? 'Published' : 'Draft'}
                </Badge>
                <span aria-hidden="true">&middot;</span>
                <span>{formatBlogDate(post.created_at)}</span>
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

              {#if post.excerpt}
                <p
                  class="line-clamp-2 text-xs leading-relaxed font-normal text-text-primary">
                  {post.excerpt}
                </p>
              {/if}

              <div
                class="no-scrollbar mt-auto flex w-full flex-wrap items-center justify-between gap-2 overflow-x-auto border-t border-border-subtle/40 pt-3.5 whitespace-nowrap">
                <div class="flex flex-wrap items-center gap-2">
                  <Button
                    type="button"
                    variant="primary"
                    size="sm"
                    onclick={() =>
                      (window.location.href = `/admin/new?id=${post.id}`)}>
                    Edit
                  </Button>

                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    aria-expanded={expandedPostIds.has(post.id)}
                    aria-controls="comments-{post.id}"
                    onclick={() => toggleComments(post.id)}>
                    {expandedPostIds.has(post.id) ? 'Hide' : 'Show'} comments ({getPostComments(
                      post.id
                    ).length})
                  </Button>

                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onclick={() => handleTogglePublished(post)}>
                    {post.published ? 'Unpublish' : 'Publish'}
                  </Button>
                </div>

                <div class="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="danger"
                    size="sm"
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
                      {replyTo}
                      getIcon={getCommentIcon}>
                      {#snippet statusBadge(comment)}
                        <Badge
                          variant={comment.is_approved ? 'success' : 'warning'}>
                          {comment.is_approved ? 'Approved' : 'Pending'}
                        </Badge>
                      {/snippet}

                      {#snippet actions(comment)}
                        <time datetime={comment.created_at}>
                          {formatBlogDate(comment.created_at)}
                        </time>
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
                            replyTo = comment
                            commentContent = ''
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
                          class="rounded-xl border border-border-subtle bg-surface-card p-4">
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
                              variant="ghost"
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
                              type="submit"
                              variant="primary"
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
            </div>
          {/each}
        </div>
      {/if}
    {:else if activeAdminTab === 'author'}
      <form
        onsubmit={handleSaveAuthor}
        class="flex flex-col gap-8 rounded-md border border-border-subtle bg-surface-card p-6 shadow-xs">
        <div class="flex items-start justify-between gap-4">
          <div>
            <h2 class="text-2xl font-bold tracking-tight text-text-primary">
              Author Profile
            </h2>
            <p class="mt-1 text-xs text-text-secondary">
              Manage your public author profile and contact details.
            </p>
          </div>
          {#if authorIsDirty}
            <span
              class="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-1 text-[11px] font-semibold text-amber-600 select-none dark:text-amber-400">
              <i
                class="bi bi-circle-fill text-[6px]"
                aria-hidden="true"></i>
              Unsaved changes
            </span>
          {/if}
        </div>

        {#if authorSaveError}<StatusBanner
            type="error"
            message={authorSaveError} />{/if}
        {#if authorSaveSuccess}<StatusBanner
            type="success"
            message="Author Profile saved successfully to Supabase!" />{/if}

        <div class="flex flex-col gap-10">
          <section aria-labelledby="section-identity">
            <h3
              id="section-identity"
              class="mb-4 text-[11px] font-bold tracking-widest text-text-secondary uppercase select-none">
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
              class="mb-4 text-[11px] font-bold tracking-widest text-text-muted uppercase select-none">
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
                  <div
                    class="relative flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full border border-border-subtle bg-surface-base select-none">
                    {#if avatarPreviewUrl}
                      <img
                        src={avatarPreviewUrl}
                        alt="Avatar preview"
                        class="h-full w-full object-cover"
                        onerror={e => {
                          const target = e.currentTarget as HTMLImageElement
                          target.style.display = 'none'
                          const fallback =
                            target.nextElementSibling as HTMLElement
                          if (fallback) fallback.style.display = 'flex'
                        }} />
                      <div
                        class="flex hidden h-full w-full items-center justify-center bg-surface-subtle">
                        <i
                          class="bi bi-person-fill text-lg text-text-muted"
                          aria-hidden="true"></i>
                      </div>
                    {:else}
                      <i
                        class="bi bi-person-fill text-lg text-text-muted"
                        aria-hidden="true"></i>
                    {/if}
                  </div>
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
                  type="email"
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
              class="mb-4 text-[11px] font-bold tracking-widest text-text-secondary uppercase select-none">
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
              class="mb-4 text-[11px] font-bold tracking-widest text-text-secondary uppercase select-none">
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

        <div
          class="flex items-center justify-end gap-3 border-t border-border-subtle/60 pt-4">
          {#if authorIsDirty}
            <p class="text-xs text-text-secondary select-none">
              You have unsaved changes.
            </p>
          {/if}
          <Button
            type="submit"
            variant="primary"
            size="md"
            disabled={!authorIsDirty}
            isLoading={isSavingAuthor}>
            Save Profile
          </Button>
        </div>
      </form>
    {:else if activeAdminTab === 'cv'}
      <form
        onsubmit={handleSaveCv}
        class="flex flex-col gap-8">
        {#if cvSaveSuccess}
          <StatusBanner
            type="success"
            message="CV Entries saved successfully to Supabase!" />
        {/if}

        <div
          class="flex flex-col gap-4 rounded-md border border-border-subtle bg-surface-card p-6 shadow-xs">
          <div class="flex items-center justify-between">
            <h2 class="text-xl font-bold text-text-primary">Experiences</h2>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onclick={() => handleAddCvEntry('experience')}>
              + Add Experience
            </Button>
          </div>

          <div class="flex flex-col gap-6">
            {#each cvState.experience as exp, idx (idx)}
              <div
                class="flex flex-col gap-4 rounded-md border border-border-subtle/80 bg-surface-base p-4">
                <div
                  class="flex items-center justify-between border-b border-border-subtle/40 pb-2">
                  <span class="font-mono text-xs font-light text-text-muted"
                    >Experience Entry #{idx + 1}</span>
                  <div class="flex items-center gap-1">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      aria-label="Move experience item up"
                      title="Move experience item up"
                      disabled={idx === 0}
                      onclick={() =>
                        (cvState.experience = moveArrayItem(
                          cvState.experience,
                          idx,
                          'up'
                        ))}>↑</Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      aria-label="Move experience item down"
                      title="Move experience item down"
                      disabled={idx === cvState.experience.length - 1}
                      onclick={() =>
                        (cvState.experience = moveArrayItem(
                          cvState.experience,
                          idx,
                          'down'
                        ))}>↓</Button>
                    <Button
                      type="button"
                      variant="danger"
                      size="sm"
                      onclick={() => handleRemoveCvEntry('experience', idx)}
                      >Delete</Button>
                  </div>
                </div>

                <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <FormField
                    id={'exp-title-' + idx}
                    label="Title"
                    required
                    counter={`${(exp.title || '').length}/50`}>
                    <Input
                      id={'exp-title-' + idx}
                      bind:value={exp.title}
                      placeholder="Ex: Software Engineer"
                      maxlength={50}
                      required />
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
                  counter={`${(exp.company || '').length}/100`}>
                  <Input
                    id={'exp-company-' + idx}
                    bind:value={exp.company}
                    placeholder="Ex: Berkshire Hathaway"
                    maxlength={100}
                    required />
                </FormField>

                <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <FormField
                    id={'exp-location-' + idx}
                    label="Location"
                    required
                    counter={`${(exp.location || '').length}/100`}>
                    <Input
                      id={'exp-location-' + idx}
                      bind:value={exp.location}
                      placeholder="Ex: London, United Kingdom"
                      maxlength={100}
                      required />
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
                        options={getStartYearOptions().map(y => ({
                          value: y,
                          label: String(y)
                        }))}
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
                            exp.endMonth = null
                            exp.endYear = null
                          }
                        }} />
                    </div>
                  </FormField>
                </div>

                <FormField
                  id={'exp-desc-' + idx}
                  label="Description"
                  required
                  counter={`${(exp.description || '').length}/1000`}>
                  <Textarea
                    id={'exp-desc-' + idx}
                    bind:value={exp.description}
                    placeholder="Describe your experience..."
                    rows={3}
                    maxlength={1000}
                    required />
                </FormField>
              </div>
            {/each}
          </div>
        </div>

        <div
          class="flex flex-col gap-4 rounded-md border border-border-subtle bg-surface-card p-6 shadow-xs">
          <div class="flex items-center justify-between">
            <h2 class="text-xl font-bold text-text-primary">Education</h2>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onclick={() => handleAddCvEntry('education')}>
              + Add Education
            </Button>
          </div>

          <div class="flex flex-col gap-6">
            {#each cvState.education as edu, idx (idx)}
              <div
                class="flex flex-col gap-4 rounded-md border border-border-subtle/80 bg-surface-base p-4">
                <div
                  class="flex items-center justify-between border-b border-border-subtle/40 pb-2">
                  <span class="font-mono text-xs font-light text-text-muted"
                    >Education Entry #{idx + 1}</span>
                  <div class="flex items-center gap-1">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      aria-label="Move education item up"
                      title="Move education item up"
                      disabled={idx === 0}
                      onclick={() =>
                        (cvState.education = moveArrayItem(
                          cvState.education,
                          idx,
                          'up'
                        ))}>↑</Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      aria-label="Move education item down"
                      title="Move education item down"
                      disabled={idx === cvState.education.length - 1}
                      onclick={() =>
                        (cvState.education = moveArrayItem(
                          cvState.education,
                          idx,
                          'down'
                        ))}>↓</Button>
                    <Button
                      type="button"
                      variant="danger"
                      size="sm"
                      onclick={() => handleRemoveCvEntry('education', idx)}
                      >Delete</Button>
                  </div>
                </div>

                <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <FormField
                    id={'edu-inst-' + idx}
                    label="Institution"
                    required
                    counter={`${(edu.institution || '').length}/100`}>
                    <Input
                      id={'edu-inst-' + idx}
                      bind:value={edu.institution}
                      placeholder="Ex: Massachusetts Institute of Technology"
                      maxlength={100}
                      required />
                  </FormField>

                  <FormField
                    id={'edu-degree-' + idx}
                    label="Degree"
                    required
                    counter={`${(edu.degree || '').length}/100`}>
                    <Input
                      id={'edu-degree-' + idx}
                      bind:value={edu.degree}
                      placeholder="Ex: Bachelor of Computer Science"
                      maxlength={100}
                      required />
                  </FormField>

                  <FormField
                    id={'edu-field-' + idx}
                    label="Field of Study"
                    required
                    counter={`${(edu.field || '').length}/100`}>
                    <Input
                      id={'edu-field-' + idx}
                      bind:value={edu.field}
                      placeholder="Ex: Computer Science"
                      maxlength={100}
                      required />
                  </FormField>

                  <FormField
                    id={'edu-grade-' + idx}
                    label="Grade"
                    required
                    counter={`${(edu.grade || '').length}/50`}>
                    <Input
                      id={'edu-grade-' + idx}
                      bind:value={edu.grade}
                      placeholder="Ex: 3.99/4.00"
                      maxlength={50}
                      required />
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
                        options={getStartYearOptions().map(y => ({
                          value: y,
                          label: String(y)
                        }))}
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
                            edu.endMonth = null
                            edu.endYear = null
                          }
                        }} />
                    </div>
                  </FormField>
                </div>

                <FormField
                  id={'edu-desc-' + idx}
                  label="Description"
                  required
                  counter={`${(edu.description || '').length}/1000`}>
                  <Textarea
                    id={'edu-desc-' + idx}
                    bind:value={edu.description}
                    placeholder="Describe your education..."
                    rows={3}
                    maxlength={1000}
                    required />
                </FormField>
              </div>
            {/each}
          </div>
        </div>

        <div class="flex justify-end">
          <Button
            type="submit"
            variant="primary"
            size="md"
            isLoading={isSavingCv}>Save CV Entries</Button>
        </div>
      </form>

      <!-- CV Document Management Redesign -->
      <div
        class="mt-10 flex flex-col gap-6 rounded-2xl border border-border-subtle bg-surface-card/80 p-6 shadow-xs backdrop-blur-md sm:p-8">
        <!-- Header -->
        <div
          class="flex items-start gap-3.5 border-b border-border-subtle/60 pb-6">
          <span
            class="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-copilot/30 bg-copilot/10 text-copilot shadow-2xs">
            <i
              class="bi bi-file-earmark-pdf text-2xl leading-none"
              aria-hidden="true"></i>
          </span>
          <div class="flex flex-col gap-1">
            <h2 class="text-xl font-bold tracking-tight text-text-primary">
              CV Document Management
            </h2>
            <p class="text-xs leading-relaxed font-normal text-text-secondary">
              Upload, manage, and publish your official curriculum vitae PDF
              document accessible across your portfolio and public API.
            </p>
          </div>
        </div>

        {#if pdfUploadError}
          <StatusBanner
            type="error"
            message={pdfUploadError} />
        {/if}

        {#if pdfUploadSuccess}
          <StatusBanner
            type="success"
            message={pdfUploadSuccess} />
        {/if}

        <!-- 2-Column Grid Layout on Desktop -->
        <div class="grid grid-cols-1 gap-6 lg:grid-cols-2 lg:gap-8">
          <!-- Left Column: Upload Hero Dropzone -->
          <form
            onsubmit={handleUploadPdf}
            class="flex flex-col justify-between gap-5 rounded-2xl border border-border-subtle bg-surface/50 p-6 transition-all hover:border-border-strong">
            <div>
              <div class="mb-4 flex items-center justify-between">
                <div class="flex items-center gap-2">
                  <span class="h-2 w-2 rounded-full bg-copilot"></span>
                  <h3
                    class="text-sm font-bold tracking-wider text-text-primary uppercase">
                    {selectedPdfFile ? 'File Selected'
                    : cvDocState && cvDocState.filename ? 'Replace CV Document'
                    : 'Upload New CV'}
                  </h3>
                </div>
                {#if selectedPdfFile}
                  <span
                    class="inline-flex items-center rounded-full bg-copilot/15 px-2.5 py-0.5 font-mono text-[11px] font-semibold text-copilot">
                    Ready to upload
                  </span>
                {/if}
              </div>

              <!-- Hidden File Input -->
              <input
                type="file"
                id="cv-pdf-upload"
                accept="application/pdf,.pdf"
                onchange={e => {
                  const files = (e.currentTarget as HTMLInputElement).files
                  if (files && files.length > 0) {
                    const file = files[0]
                    if (file.size > 10 * 1024 * 1024) {
                      pdfUploadError = 'File size exceeds 10 MB limit.'
                      selectedPdfFile = null
                      return
                    }
                    selectedPdfFile = file
                    pdfUploadError = ''
                  }
                }}
                class="hidden" />

              <!-- Hero Dropzone Area -->
              <div
                role="region"
                aria-label="CV PDF Dropzone"
                ondragover={e => {
                  e.preventDefault()
                  isDraggingFile = true
                }}
                ondragleave={e => {
                  e.preventDefault()
                  isDraggingFile = false
                }}
                ondrop={handleFileDrop}
                class="group relative flex min-h-[210px] cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed p-6 text-center transition-all select-none
                  {isDraggingFile ?
                  'scale-[0.99] border-copilot bg-copilot/10'
                : 'border-border-subtle bg-surface-card/60 hover:border-copilot/60 hover:bg-surface-hover/80'}">
                {#if selectedPdfFile}
                  <!-- File Selected View -->
                  <div class="flex flex-col items-center gap-3">
                    <div
                      class="flex h-14 w-14 items-center justify-center rounded-2xl border border-copilot/40 bg-copilot/10 text-copilot shadow-xs">
                      <i
                        class="bi bi-file-earmark-pdf-fill text-2xl"
                        aria-hidden="true"></i>
                    </div>
                    <div
                      class="flex max-w-full flex-col items-center gap-0.5 px-2">
                      <p
                        class="max-w-[260px] truncate font-mono text-sm font-bold text-text-primary">
                        {selectedPdfFile.name}
                      </p>
                      <p class="font-mono text-xs text-text-secondary">
                        {(selectedPdfFile.size / (1024 * 1024)).toFixed(2)} MB
                      </p>
                    </div>
                    <button
                      type="button"
                      onclick={() => (selectedPdfFile = null)}
                      class="mt-1 inline-flex items-center gap-1.5 rounded-lg border border-border-subtle bg-surface-base px-3 py-1 font-mono text-[11px] font-semibold text-text-muted transition-colors hover:border-danger/40 hover:text-danger">
                      <i
                        class="bi bi-x-circle text-xs"
                        aria-hidden="true"></i>
                      <span>Change file</span>
                    </button>
                  </div>
                {:else if isUploadingPdf}
                  <!-- Uploading State -->
                  <div class="flex flex-col items-center gap-3">
                    <div
                      class="flex h-12 w-12 items-center justify-center rounded-full border border-copilot/30 bg-copilot/10">
                      <i
                        class="bi bi-arrow-repeat animate-spin text-xl text-copilot"
                        aria-hidden="true"></i>
                    </div>
                    <p class="font-mono text-xs font-semibold text-copilot">
                      Uploading to Cloudflare R2...
                    </p>
                    <div
                      class="h-1.5 w-36 overflow-hidden rounded-full bg-surface-subtle">
                      <div
                        class="h-full w-2/3 animate-pulse rounded-full bg-copilot">
                      </div>
                    </div>
                  </div>
                {:else}
                  <!-- Empty Dropzone View -->
                  <label
                    for="cv-pdf-upload"
                    class="flex cursor-pointer flex-col items-center gap-3">
                    <div
                      class="flex h-12 w-12 items-center justify-center rounded-2xl border border-border-subtle bg-surface-base text-text-secondary transition-all group-hover:scale-110 group-hover:border-copilot/40 group-hover:text-copilot">
                      <i
                        class="bi bi-cloud-arrow-up text-2xl"
                        aria-hidden="true"></i>
                    </div>
                    <div class="flex flex-col items-center gap-1">
                      <span class="text-sm font-semibold text-text-primary">
                        Drag & drop your CV PDF here
                      </span>
                      <span class="text-xs text-text-muted">
                        Only PDF format supported (max 10 MB)
                      </span>
                    </div>
                    <span
                      class="mt-1 inline-flex h-8 items-center justify-center rounded-lg bg-surface-base px-3.5 text-xs font-semibold text-text-primary transition-colors group-hover:border-copilot group-hover:text-copilot">
                      Choose file
                    </span>
                  </label>
                {/if}
              </div>
            </div>

            <div
              class="flex items-center justify-between border-t border-border-subtle/40 pt-4">
              <span class="font-mono text-[11px] text-text-muted">
                {selectedPdfFile ? '1 file queued' : 'No file chosen'}
              </span>
              <Button
                type="submit"
                variant="primary"
                size="md"
                disabled={!selectedPdfFile || isUploadingPdf}
                isLoading={isUploadingPdf}>
                Upload & Publish
              </Button>
            </div>
          </form>

          <!-- Right Column: Active CV Document OR Empty State Card -->
          {#if cvDocState && cvDocState.filename}
            <!-- Active CV Document Card -->
            <div
              class="flex flex-col justify-between gap-6 rounded-2xl border border-copilot/30 bg-copilot/5 p-6 shadow-xs backdrop-blur-md">
              <div class="flex flex-col gap-4">
                <!-- Status Badge Header -->
                <div class="flex items-center justify-between">
                  <span
                    class="inline-flex items-center gap-1.5 rounded-full border border-copilot/30 bg-copilot/10 px-3 py-1 font-mono text-xs font-semibold text-copilot">
                    <span class="h-2 w-2 animate-pulse rounded-full bg-copilot"
                    ></span>
                    Active Document
                  </span>
                  <span class="font-mono text-[11px] text-text-muted">
                    Cloudflare R2 CDN
                  </span>
                </div>

                <!-- Document Header Box -->
                <div
                  class="flex items-start gap-4 rounded-xl border border-border-subtle bg-surface-card p-4">
                  <div
                    class="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-copilot/40 bg-copilot/10 text-copilot">
                    <i
                      class="bi bi-file-earmark-pdf-fill text-2xl"
                      aria-hidden="true"></i>
                  </div>
                  <div class="flex min-w-0 flex-col overflow-hidden">
                    <h3
                      class="truncate font-mono text-sm font-bold text-text-primary"
                      title={cvDocState.filename}>
                      {cvDocState.filename}
                    </h3>
                    <span class="mt-0.5 text-xs text-text-secondary">
                      Publicly accessible resume
                    </span>
                  </div>
                </div>

                <!-- Metadata Grid -->
                <div
                  class="flex flex-col gap-2 rounded-xl border border-border-subtle/80 bg-surface-base/60 p-4 font-mono text-xs">
                  <div
                    class="flex items-center justify-between text-text-secondary">
                    <span class="text-text-muted">Format:</span>
                    <span class="font-semibold text-text-primary"
                      >PDF Document</span>
                  </div>
                  <div
                    class="flex items-center justify-between text-text-secondary">
                    <span class="text-text-muted">Status:</span>
                    <span class="font-semibold text-copilot"
                      >Live & Synced</span>
                  </div>
                  {#if cvDocState.hash}
                    <div
                      class="flex flex-col gap-1.5 border-t border-border-subtle/40 pt-3">
                      <span class="text-[11px] text-text-muted"
                        >SHA-256 Checksum:</span>
                      <div
                        class="flex items-center justify-between gap-2 overflow-hidden rounded-lg border border-border-subtle/80 bg-surface-base/80 p-2.5 font-mono text-[11px]">
                        <span
                          class="no-scrollbar min-w-0 flex-1 overflow-x-auto whitespace-nowrap text-text-primary select-all">
                          {cvDocState.hash}
                        </span>
                        <button
                          type="button"
                          onclick={() => {
                            navigator.clipboard
                              .writeText(cvDocState.hash || '')
                              .then(() => {
                                copiedCvHash = true
                                setTimeout(() => (copiedCvHash = false), 2000)
                              })
                          }}
                          class="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-border-subtle bg-surface-card text-text-secondary transition-colors hover:border-copilot hover:text-copilot focus:outline-none"
                          aria-label="Copy SHA-256 checksum"
                          title="Copy SHA-256 checksum">
                          {#if copiedCvHash}
                            <i
                              class="bi bi-check2 text-xs font-bold text-copilot"
                              aria-hidden="true"></i>
                          {:else}
                            <i
                              class="bi bi-clipboard text-xs"
                              aria-hidden="true"></i>
                          {/if}
                        </button>
                      </div>
                    </div>
                  {/if}
                </div>
              </div>

              <div
                class="flex flex-wrap items-center justify-between gap-2 border-t border-border-subtle/40 pt-4">
                <div class="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onclick={() =>
                      window.open(cvDocState.fileUrl || '/cv.pdf', '_blank')}>
                    <i
                      class="bi bi-box-arrow-up-right text-xs"
                      aria-hidden="true"></i>
                    <span>Open PDF</span>
                  </Button>

                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onclick={() =>
                      document.getElementById('cv-pdf-upload')?.click()}>
                    <i
                      class="bi bi-arrow-repeat text-xs"
                      aria-hidden="true"></i>
                    <span>Replace</span>
                  </Button>
                </div>

                <Button
                  type="button"
                  variant="danger"
                  size="sm"
                  onclick={handleDeleteCvDoc}>
                  <i
                    class="bi bi-trash3 text-xs"
                    aria-hidden="true"></i>
                  <span>Delete</span>
                </Button>
              </div>
            </div>
          {:else}
            <!-- Empty State Card -->
            <div
              class="flex min-h-[300px] flex-col items-center justify-center gap-4 rounded-2xl border border-dashed border-border-subtle bg-surface/30 p-8 text-center">
              <div
                class="flex h-14 w-14 items-center justify-center rounded-2xl border border-border-subtle bg-surface-base text-2xl text-text-muted shadow-xs">
                <i
                  class="bi bi-file-earmark-x"
                  aria-hidden="true"></i>
              </div>
              <div class="flex max-w-sm flex-col items-center gap-1">
                <h3 class="text-base font-bold text-text-primary">
                  No active CV uploaded yet
                </h3>
                <p class="text-xs leading-relaxed text-text-secondary">
                  Upload your official CV PDF document so visitors and AI search
                  engines can retrieve and download your resume.
                </p>
              </div>
              <Button
                type="button"
                variant="primary"
                size="sm"
                onclick={() =>
                  document.getElementById('cv-pdf-upload')?.click()}>
                Upload your first CV
              </Button>
            </div>
          {/if}
        </div>
      </div>
    {:else if activeAdminTab === 'skills'}
      <form
        onsubmit={handleSaveSkills}
        class="flex flex-col gap-6 rounded-md border border-border-subtle bg-surface-card p-6 shadow-xs">
        <div class="flex items-center justify-between">
          <h2 class="text-xl font-bold text-text-primary">Skills</h2>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onclick={handleAddSkill}>+ Add Skill</Button>
        </div>

        {#if skillsSaveSuccess}<StatusBanner
            type="success"
            message="Skills saved successfully to Supabase!" />{/if}

        <div class="flex flex-col gap-4">
          {#each skillsState as item, idx (idx)}
            <div
              class="flex flex-col gap-3 rounded-md border border-border-subtle/80 bg-surface-base p-4">
              <div
                class="flex items-center justify-between border-b border-border-subtle/40 pb-2">
                <span class="font-mono text-xs font-light text-text-muted"
                  >Category #{idx + 1}</span>
                <div class="flex items-center gap-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    aria-label="Move skill up"
                    title="Move skill up"
                    disabled={idx === 0}
                    onclick={() =>
                      (skillsState = moveArrayItem(skillsState, idx, 'up'))}
                    >↑</Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    aria-label="Move skill down"
                    title="Move skill down"
                    disabled={idx === skillsState.length - 1}
                    onclick={() =>
                      (skillsState = moveArrayItem(skillsState, idx, 'down'))}
                    >↓</Button>
                  <Button
                    type="button"
                    variant="danger"
                    size="sm"
                    onclick={() => handleRemoveSkill(idx)}>Delete</Button>
                </div>
              </div>

              <FormField
                id={'sk-cat-' + idx}
                label="Category Name"
                required
                counter={`${(item.category || '').length}/100`}>
                <Input
                  id={'sk-cat-' + idx}
                  bind:value={item.category}
                  placeholder="Ex: Software Engineering"
                  maxlength={100}
                  required />
              </FormField>

              <FormField
                id={'sk-list-' + idx}
                label="Skills (Comma Separated)">
                <div
                  class="flex flex-wrap items-center gap-2 rounded-lg border border-border-subtle bg-surface-base p-2 focus-within:border-copilot focus-within:ring-1 focus-within:ring-copilot">
                  {#each item.skills as skill, sIdx (sIdx)}
                    <span
                      draggable="true"
                      ondragstart={e => handleSkillDragStart(sIdx, e)}
                      ondragover={e => e.preventDefault()}
                      ondrop={e => handleSkillDrop(idx, sIdx, e)}
                      class="inline-flex items-center gap-1 rounded-full border border-copilot/30 bg-copilot/10 py-1 pr-1.5 pl-2 font-mono text-xs font-medium text-copilot transition-all hover:border-copilot/50">
                      <span
                        class="cursor-grab text-copilot/60 hover:text-copilot active:cursor-grabbing">
                        <i
                          class="bi bi-grip-horizontal text-xs leading-none"
                          aria-hidden="true"></i>
                      </span>
                      {#if editingSkillKey === `${idx}-${sIdx}`}
                        <input
                          type="text"
                          bind:value={editingSkillText}
                          class="w-20 border-0 border-none bg-transparent font-mono text-xs font-medium text-copilot shadow-none ring-0 outline-none focus:border-none focus:ring-0 focus:outline-none focus-visible:border-none focus-visible:ring-0 focus-visible:outline-none"
                          onkeydown={e => {
                            if (e.key === 'Enter' || e.key === ',') {
                              e.preventDefault()
                              saveEditSkill(idx, sIdx)
                            }
                          }}
                          onblur={() => saveEditSkill(idx, sIdx)}
                          autofocus />
                      {:else}
                        <span
                          class="cursor-pointer hover:underline"
                          onclick={() => startEditSkill(idx, sIdx, skill)}>
                          {skill}
                        </span>
                      {/if}
                      <button
                        type="button"
                        class="ml-0.5 inline-flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full text-copilot hover:bg-copilot/20 focus:outline-none"
                        aria-label="Remove {skill}"
                        onclick={() => {
                          item.skills = item.skills.filter((_, i) => i !== sIdx)
                        }}>
                        <i
                          class="bi bi-x text-xs leading-none"
                          aria-hidden="true"></i>
                      </button>
                    </span>
                  {/each}
                  <input
                    id={'sk-list-' + idx}
                    type="text"
                    class="min-w-35 flex-1 border-0 border-none bg-transparent font-mono text-xs text-text-primary shadow-none ring-0 outline-none placeholder:text-text-muted focus:border-none focus:ring-0 focus:outline-none focus-visible:border-none focus-visible:ring-0 focus-visible:outline-none"
                    placeholder={item.skills.length === 0 ?
                      'Type skill and press comma...'
                    : 'Add skill...'}
                    onkeydown={e => {
                      if (e.key === ',' || e.key === 'Enter') {
                        e.preventDefault()
                        const target = e.currentTarget as HTMLInputElement
                        const val = target.value.trim().replace(/^,|,$/g, '')
                        if (val && !item.skills.includes(val)) {
                          item.skills = [...item.skills, val]
                        }
                        target.value = ''
                      }
                    }}
                    onkeyup={e => {
                      if (e.key === ',') {
                        const target = e.currentTarget as HTMLInputElement
                        const val = target.value.trim().replace(/,/g, '')
                        if (val && !item.skills.includes(val)) {
                          item.skills = [...item.skills, val]
                        }
                        target.value = ''
                      }
                    }}
                    onblur={e => {
                      const target = e.currentTarget as HTMLInputElement
                      const val = target.value.trim().replace(/,/g, '')
                      if (val && !item.skills.includes(val)) {
                        item.skills = [...item.skills, val]
                      }
                      target.value = ''
                    }} />
                </div>
              </FormField>
            </div>
          {/each}
        </div>

        <div class="flex justify-end">
          <Button
            type="submit"
            variant="primary"
            size="md"
            isLoading={isSavingSkills}>Save Skills</Button>
        </div>
      </form>
    {:else if activeAdminTab === 'socials'}
      <form
        onsubmit={handleSaveSocials}
        class="flex flex-col gap-6 rounded-md border border-border-subtle bg-surface-card p-6 shadow-xs">
        <div class="flex items-center justify-between">
          <h2 class="text-xl font-bold text-text-primary">Social Links</h2>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onclick={handleAddSocial}>+ Add Social</Button>
        </div>

        {#if socialsSaveSuccess}<StatusBanner
            type="success"
            message="Social links saved successfully!" />{/if}

        <div class="flex flex-col gap-4">
          {#each socialState as item, idx (idx)}
            <div
              class="flex flex-col gap-3 rounded-md border border-border-subtle/80 bg-surface-base p-4">
              <div
                class="flex items-center justify-between border-b border-border-subtle/40 pb-2">
                <span class="font-mono text-xs text-text-muted"
                  >Social #{idx + 1}</span>
                <div class="flex items-center gap-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    aria-label="Move social link up"
                    title="Move social link up"
                    disabled={idx === 0}
                    onclick={() =>
                      (socialState = moveArrayItem(socialState, idx, 'up'))}
                    >↑</Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    aria-label="Move social link down"
                    title="Move social link down"
                    disabled={idx === socialState.length - 1}
                    onclick={() =>
                      (socialState = moveArrayItem(socialState, idx, 'down'))}
                    >↓</Button>
                  <Button
                    type="button"
                    variant="danger"
                    size="sm"
                    onclick={() => handleRemoveSocial(idx)}>Delete</Button>
                </div>
              </div>

              <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <FormField
                  id={'soc-icon-' + idx}
                  label="Icon Name"
                  required
                  counter={`${(item.icon || '').length}/50`}>
                  <div class="flex items-center gap-2">
                    <div
                      class="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-border-subtle bg-surface-card text-copilot">
                      <i
                        class="bi {sanitizeIconClass(
                          item.icon,
                          'bi-people'
                        )} text-base {item.icon?.trim() ?
                          'text-copilot'
                        : 'text-text-muted opacity-50'}"></i>
                    </div>
                    <Input
                      id={'soc-icon-' + idx}
                      bind:value={item.icon}
                      placeholder="default: bi-people"
                      maxlength={50}
                      required />
                  </div>
                </FormField>

                <FormField
                  id={'soc-plat-' + idx}
                  label="Platform"
                  required
                  counter={`${(item.platform || '').length}/50`}>
                  <Input
                    id={'soc-plat-' + idx}
                    bind:value={item.platform}
                    placeholder="Ex: GitHub"
                    maxlength={50}
                    required />
                </FormField>
              </div>

              <FormField
                id={'soc-url-' + idx}
                label="Platform URL"
                required
                counter={`${(item.url || '').length}/100`}>
                <Input
                  id={'soc-url-' + idx}
                  bind:value={item.url}
                  placeholder="Ex: https://github.com/torvalds"
                  maxlength={100}
                  required />
              </FormField>
            </div>
          {/each}
        </div>

        <div class="flex justify-end">
          <Button
            type="submit"
            variant="primary"
            size="md"
            isLoading={isSavingSocials}>Save Social Links</Button>
        </div>
      </form>
    {:else if activeAdminTab === 'sponsorship'}
      <form
        onsubmit={handleSaveSponsorship}
        class="flex flex-col gap-6 rounded-md border border-border-subtle bg-surface-card p-6 shadow-xs">
        <div class="flex items-center justify-between">
          <h2 class="text-xl font-bold text-text-primary">Sponsorship</h2>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onclick={handleAddSponsorship}>+ Add Sponsorship</Button>
        </div>

        {#if sponsorshipSaveSuccess}<StatusBanner
            type="success"
            message="Sponsorship links saved successfully!" />{/if}

        <div class="flex flex-col gap-4">
          {#each sponsorshipState as item, idx (idx)}
            <div
              class="flex flex-col gap-3 rounded-md border border-border-subtle/80 bg-surface-base p-4">
              <div
                class="flex items-center justify-between border-b border-border-subtle/40 pb-2">
                <span class="font-mono text-xs text-text-muted"
                  >Sponsorship #{idx + 1}</span>
                <div class="flex items-center gap-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    aria-label="Move sponsorship link up"
                    title="Move sponsorship link up"
                    disabled={idx === 0}
                    onclick={() =>
                      (sponsorshipState = moveArrayItem(
                        sponsorshipState,
                        idx,
                        'up'
                      ))}>↑</Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    aria-label="Move sponsorship link down"
                    title="Move sponsorship link down"
                    disabled={idx === sponsorshipState.length - 1}
                    onclick={() =>
                      (sponsorshipState = moveArrayItem(
                        sponsorshipState,
                        idx,
                        'down'
                      ))}>↓</Button>
                  <Button
                    type="button"
                    variant="danger"
                    size="sm"
                    onclick={() => handleRemoveSponsorship(idx)}>Delete</Button>
                </div>
              </div>

              <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <FormField
                  id={'sp-plat-' + idx}
                  label="Platform Name"
                  required
                  counter={`${(item.platform || '').length}/50`}>
                  <Input
                    id={'sp-plat-' + idx}
                    bind:value={item.platform}
                    placeholder="Ex: Ko-fi"
                    maxlength={50}
                    required />
                </FormField>

                <FormField
                  id={'sp-val-' + idx}
                  label="Display Value"
                  required
                  counter={`${(item.displayValue || '').length}/50`}>
                  <Input
                    id={'sp-val-' + idx}
                    bind:value={item.displayValue}
                    placeholder="Ex: @farhnkrnapratma"
                    maxlength={50}
                    required />
                </FormField>

                <FormField
                  id={'sp-icon-' + idx}
                  label="Icon Name"
                  required
                  counter={`${(item.icon || '').length}/50`}>
                  <div class="flex items-center gap-2">
                    <div
                      class="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-border-subtle bg-surface-card text-copilot">
                      <i
                        class="bi {sanitizeIconClass(
                          item.icon,
                          'bi-currency-dollar'
                        )} text-base {item.icon?.trim() ?
                          'text-copilot'
                        : 'text-text-muted opacity-50'}"></i>
                    </div>
                    <Input
                      id={'sp-icon-' + idx}
                      bind:value={item.icon}
                      placeholder="default: bi-currency-dollar"
                      maxlength={50}
                      required />
                  </div>
                </FormField>

                <FormField
                  id={'sp-url-' + idx}
                  label="Platform URL"
                  required
                  counter={`${(item.url || '').length}/100`}>
                  <Input
                    id={'sp-url-' + idx}
                    bind:value={item.url}
                    placeholder="Ex: https://ko-fi.com/farhnkrnapratma"
                    maxlength={100}
                    required />
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

        <div class="flex justify-end">
          <Button
            type="submit"
            variant="primary"
            size="md"
            isLoading={isSavingSponsorship}>Save Sponsorship Links</Button>
        </div>
      </form>
    {:else if activeAdminTab === 'contact'}
      <form
        onsubmit={handleSaveContact}
        class="flex flex-col gap-6 rounded-md border border-border-subtle bg-surface-card p-6 shadow-xs">
        <div class="flex items-center justify-between">
          <h2 class="text-xl font-bold text-text-primary">Contact Info</h2>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onclick={handleAddContact}>+ Add Contact</Button>
        </div>

        {#if contactSaveSuccess}<StatusBanner
            type="success"
            message="Contact info saved successfully!" />{/if}

        <div class="flex flex-col gap-4">
          {#each contactState as item, idx (idx)}
            <div
              class="flex flex-col gap-3 rounded-md border border-border-subtle/80 bg-surface-base p-4">
              <div
                class="flex items-center justify-between border-b border-border-subtle/40 pb-2">
                <span class="font-mono text-xs text-text-muted"
                  >Contact Info #{idx + 1}</span>
                <div class="flex items-center gap-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    aria-label="Move contact item up"
                    title="Move contact item up"
                    disabled={idx === 0}
                    onclick={() =>
                      (contactState = moveArrayItem(contactState, idx, 'up'))}
                    >↑</Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    aria-label="Move contact item down"
                    title="Move contact item down"
                    disabled={idx === contactState.length - 1}
                    onclick={() =>
                      (contactState = moveArrayItem(contactState, idx, 'down'))}
                    >↓</Button>
                  <Button
                    type="button"
                    variant="danger"
                    size="sm"
                    onclick={() => handleRemoveContact(idx)}>Delete</Button>
                </div>
              </div>

              <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <FormField
                  id={'ct-plat-' + idx}
                  label="Platform Name"
                  required
                  counter={`${(item.platform || '').length}/50`}>
                  <Input
                    id={'ct-plat-' + idx}
                    bind:value={item.platform}
                    placeholder="Ex: Email"
                    maxlength={50}
                    required />
                </FormField>

                <FormField
                  id={'ct-val-' + idx}
                  label="Display Value"
                  required
                  counter={`${(item.displayValue || '').length}/50`}>
                  <Input
                    id={'ct-val-' + idx}
                    bind:value={item.displayValue}
                    placeholder="Ex: contact@fkp.my.id"
                    maxlength={50}
                    required />
                </FormField>

                <FormField
                  id={'ct-icon-' + idx}
                  label="Icon Name"
                  required
                  counter={`${(item.icon || '').length}/50`}>
                  <div class="flex items-center gap-2">
                    <div
                      class="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-border-subtle bg-surface-card text-copilot">
                      <i
                        class="bi {sanitizeIconClass(
                          item.icon,
                          'bi-person'
                        )} text-base {item.icon?.trim() ?
                          'text-copilot'
                        : 'text-text-muted opacity-50'}"></i>
                    </div>
                    <Input
                      id={'ct-icon-' + idx}
                      bind:value={item.icon}
                      placeholder="default: bi-person"
                      maxlength={50}
                      required />
                  </div>
                </FormField>

                <FormField
                  id={'ct-url-' + idx}
                  label="Platform URL"
                  required
                  counter={`${(item.href || '').length}/100`}>
                  <Input
                    id={'ct-url-' + idx}
                    bind:value={item.href}
                    placeholder="Ex: mailto:contact@fkp.my.id"
                    maxlength={100}
                    required />
                </FormField>
              </div>
            </div>
          {/each}
        </div>

        <div class="flex justify-end">
          <Button
            type="submit"
            variant="primary"
            size="md"
            isLoading={isSavingContact}>Save Contact Info</Button>
        </div>
      </form>
    {/if}
  </main>
</div>

<Dialog
  isOpen={showDeletePostDialog}
  onClose={() => (showDeletePostDialog = false)}
  title="Delete Post">
  <div class="flex flex-col gap-4">
    <p class="text-sm text-text-secondary">
      Are you sure you want to delete post "{postToDelete?.title}"?
    </p>
    <div class="flex justify-end gap-3">
      <Button
        type="button"
        variant="secondary"
        size="md"
        onclick={() => (showDeletePostDialog = false)}>Cancel</Button>
      <Button
        type="button"
        variant="danger"
        size="md"
        onclick={executeDeletePost}>Delete</Button>
    </div>
  </div>
</Dialog>

<Dialog
  isOpen={showDeleteCommentDialog}
  onClose={() => (showDeleteCommentDialog = false)}
  title="Delete Comment">
  <div class="flex flex-col gap-4">
    <p class="text-sm text-text-secondary">
      Are you sure you want to delete this comment?
    </p>
    <div class="flex justify-end gap-3">
      <Button
        type="button"
        variant="secondary"
        size="md"
        onclick={() => (showDeleteCommentDialog = false)}>Cancel</Button>
      <Button
        type="button"
        variant="danger"
        size="md"
        onclick={executeDeleteComment}>Delete</Button>
    </div>
  </div>
</Dialog>
