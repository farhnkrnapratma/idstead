/** @format */

declare global {
  namespace App {
    interface Platform {
      env: {GITHUB_TOKEN: string; AI?: unknown}
    }
  }
}

export {}
