<!-- @format -->
<script lang="ts">
  import {supabase} from '$lib/supabase'
  import {onMount} from 'svelte'
  import {Card, FormField, Input, Button, IconButton, SkipLink} from '$lib'

  let email = $state('')
  let password = $state('')
  let isSubmitting = $state(false)
  let showPassword = $state(false)
  let errors = $state({email: '', password: ''})
  let valid = $state({email: false, password: false})
  let showToast = $state(false)
  let toastMessage = $state('')

  function triggerToast(msg: string) {
    toastMessage = msg
    showToast = true
    setTimeout(() => {
      showToast = false
    }, 4000)
  }

  onMount(async () => {
    const {data} = await supabase.auth.getSession()
    if (data.session) {
      window.location.href = '/admin'
    }
  })

  function sanitizeInput(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#x27;')
      .replace(/\//g, '&#x2F;')
  }

  function debounce<T extends unknown[]>(cb: (...args: T) => void, ms: number) {
    let timer: ReturnType<typeof setTimeout>
    return (...args: T) => {
      clearTimeout(timer)
      timer = setTimeout(() => cb(...args), ms)
    }
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

  const validateEmailField = debounce(() => {
    if (email.trim() === '') {
      errors.email = ''
      valid.email = false
    } else if (!emailRegex.test(email.trim())) {
      errors.email = 'Please enter a valid email address.'
      valid.email = false
    } else {
      errors.email = ''
      valid.email = true
    }
  }, 500)

  const validatePasswordField = debounce(() => {
    if (password.trim() === '') {
      errors.password = ''
      valid.password = false
    } else {
      errors.password = ''
      valid.password = true
    }
  }, 500)

  function validate() {
    const emailErr = email.trim() === '' ? 'Email is required.' : ''
    const emailFormatErr =
      !emailErr && !emailRegex.test(email.trim()) ?
        'Please enter a valid email address.'
      : ''
    const passwordErr = password.trim() === '' ? 'Password is required.' : ''

    errors = {email: emailErr || emailFormatErr, password: passwordErr}
    if (errors.email) valid.email = false
    if (errors.password) valid.password = false

    return !errors.email && !errors.password
  }

  async function handleLogin(e: SubmitEvent) {
    e.preventDefault()
    if (!validate()) return

    isSubmitting = true

    try {
      const {error} = await supabase.auth.signInWithPassword({
        email: sanitizeInput(email.trim()),
        password: password.trim()
      })

      if (error) throw error
      window.location.href = '/admin'
    } catch (err) {
      const error = err as Error
      console.error('Login failed:', error)
      triggerToast(error.message || 'Invalid email or password.')
    } finally {
      isSubmitting = false
    }
  }
</script>

<SkipLink />

<main
  id="main-content"
  class="flex min-h-[calc(100vh-3.75rem)] flex-col items-center justify-center pt-15 font-sans">
  <div class="flex w-full max-w-sm flex-1 flex-col justify-center px-6 py-10">
    <Card variant="glass" class="p-6">
      <div class="mb-6 flex flex-col items-center text-center select-none">
        <div class="flex items-center gap-2">
          <span
            class="material-symbols-rounded text-2xl text-copilot select-none"
            aria-hidden="true">code</span>
          <h1 class="text-xl font-bold text-text-primary">Console</h1>
        </div>
        <p class="mt-1 text-xs text-text-secondary">
          Sign in to manage your blog posts
        </p>
      </div>

      <form novalidate onsubmit={handleLogin} class="flex flex-col gap-3">
        <FormField
          id="login-email"
          label="Email"
          required
          error={errors.email}
          valid={valid.email}>
          <Input
            type="email"
            id="login-email"
            placeholder="Enter your email"
            autocomplete="username"
            bind:value={email}
            error={!!errors.email}
            valid={valid.email}
            oninput={() => {
              errors.email = ''
              valid.email = false
              validateEmailField()
            }}
            aria-required="true"
            aria-invalid={!!errors.email} />
        </FormField>

        <FormField
          id="login-pass"
          label="Password"
          required
          error={errors.password}
          valid={valid.password}>
          <div class="relative flex items-center">
            <Input
              type={showPassword ? 'text' : 'password'}
              id="login-pass"
              placeholder="••••••••"
              autocomplete="current-password"
              bind:value={password}
              error={!!errors.password}
              valid={valid.password}
              oninput={() => {
                errors.password = ''
                valid.password = false
                validatePasswordField()
              }}
              aria-required="true"
              aria-invalid={!!errors.password}
              class="pr-10" />
            <div class="absolute right-1">
              <IconButton
                ariaLabel={showPassword ? 'Hide password' : 'Show password'}
                variant="ghost"
                size="sm"
                onclick={() => (showPassword = !showPassword)}>
                <span
                  class="material-symbols-rounded text-base"
                  aria-hidden="true">
                  {showPassword ? 'visibility_off' : 'visibility'}
                </span>
              </IconButton>
            </div>
          </div>
        </FormField>

        <Button
          type="submit"
          variant="primary"
          size="lg"
          isLoading={isSubmitting}
          class="mt-2 w-full">
          {isSubmitting ? 'Signing in…' : 'Sign in'}
        </Button>
      </form>
    </Card>

    <div class="mt-4 text-center select-none">
      <a
        href="/"
        class="text-xs font-semibold text-text-secondary transition-colors hover:text-copilot hover:underline">
        Back to home
      </a>
    </div>
  </div>

  <footer
    class="w-full px-6 py-8 text-center font-sans text-xs text-text-muted select-none">
    <p>
      &copy; {new Date().getFullYear()} Farhan Kurnia Pratama. All rights reserved.
    </p>
  </footer>

  {#if showToast}
    <div
      role="status"
      aria-live="polite"
      class="fixed bottom-6 left-1/2 z-110 flex -translate-x-1/2 items-center gap-2 rounded-full border border-border-subtle bg-surface-elevated/90 px-4 py-2 text-xs font-semibold text-text-primary shadow-lg backdrop-blur-md transition-all duration-300">
      <i
        class="bi bi-exclamation-circle-fill text-sm text-danger"
        aria-hidden="true"></i>
      {toastMessage}
    </div>
  {/if}
</main>
