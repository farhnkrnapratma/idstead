// SPDX-FileCopyrightText: 2026 Farhan Kurnia Pratama
//
// SPDX-License-Identifier: AGPL-3.0-only

export interface NewsletterSignupState {
    configured: boolean;
    hasAuthor: boolean;
    hasPublishedPosts: boolean;
}

export function newsletterSignupVisible(state: NewsletterSignupState): boolean {
    return state.configured && state.hasAuthor && state.hasPublishedPosts;
}
