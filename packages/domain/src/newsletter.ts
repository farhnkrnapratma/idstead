export interface NewsletterSignupState {
    configured: boolean;
    hasAuthor: boolean;
    hasPublishedPosts: boolean;
}

export function newsletterSignupVisible(state: NewsletterSignupState): boolean {
    return state.configured && state.hasAuthor && state.hasPublishedPosts;
}
