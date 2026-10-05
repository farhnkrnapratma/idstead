import {
  Flag,
  Mail,
  MessageCircle,
  MessageSquare,
  ThumbsDown,
  ThumbsUp
} from '@lucide/svelte';

export type ActivityTone =
  'report' | 'comment' | 'message' | 'feedback' | 'helpful' | 'unhelpful';

export const activityToneStyles = {
  report: {
    icon: Flag,
    label: 'Report',
    color: 'var(--color-activity-report)',
    class:
      'border-activity-report/25 bg-activity-report/10 text-activity-report'
  },
  comment: {
    icon: MessageCircle,
    label: 'Comment',
    color: 'var(--color-activity-comment)',
    class:
      'border-activity-comment/25 bg-activity-comment/10 text-activity-comment'
  },
  message: {
    icon: Mail,
    label: 'Message',
    color: 'var(--color-activity-message)',
    class:
      'border-activity-message/25 bg-activity-message/10 text-activity-message'
  },
  feedback: {
    icon: MessageSquare,
    label: 'Feedback',
    color: 'var(--color-activity-feedback)',
    class:
      'border-activity-feedback/25 bg-activity-feedback/10 text-activity-feedback'
  },
  helpful: {
    icon: ThumbsUp,
    label: 'Helpful',
    color: 'var(--color-activity-helpful)',
    class:
      'border-activity-helpful/25 bg-activity-helpful/10 text-activity-helpful'
  },
  unhelpful: {
    icon: ThumbsDown,
    label: 'Unhelpful',
    color: 'var(--color-activity-unhelpful)',
    class:
      'border-activity-unhelpful/25 bg-activity-unhelpful/10 text-activity-unhelpful'
  }
} as const;

export function activityTone(kind: string, vote?: string | null): ActivityTone {
  if (kind === 'comment_report') return 'report';
  if (kind === 'comment_new') return 'comment';
  if (kind === 'contact_message' || kind === 'feedback_report')
    return 'message';
  if (vote === 'yes') return 'helpful';
  if (vote === 'no') return 'unhelpful';
  return kind === 'helpful' ? 'helpful' : 'unhelpful';
}
