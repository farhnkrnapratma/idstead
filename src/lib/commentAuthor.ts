export const COMMENTS_PAGE_SIZE = 10;

export function commentAuthorName(
  comment: {
    is_admin?: boolean;
    is_anonymous?: boolean;
    author_name?: string | null;
  },
  authorName: string
) {
  if (comment.is_admin) {
    const name = authorName.trim() || comment.author_name?.trim() || '';
    return /^(admin|administrator|anonymous)$/i.test(name) ? '' : name;
  }
  return comment.is_anonymous ? 'Anonymous' : (
      comment.author_name?.trim() || 'Anonymous'
    );
}
