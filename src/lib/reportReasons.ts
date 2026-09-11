export const REPORT_REASONS = [
  {
    id: 'spam',
    label: 'Spam / Phishing',
    description: 'Commercial advertisements, scam links, or repetitive spam'
  },
  {
    id: 'harassment',
    label: 'Harassment / Hate',
    description: 'Abusive language, insults, harassment, or hate speech'
  },
  {
    id: 'violence_or_illegal',
    label: 'Violence / Illegal',
    description: 'Threats of violence, promotion of crime, or dangerous weapons'
  },
  {
    id: 'sexual_content',
    label: 'Sexual Content',
    description: 'Sexually explicit content or exploitation of a minor'
  },
  {
    id: 'self_harm',
    label: 'Self-Harm / Suicide',
    description: 'Content that encourages or depicts self-harm or suicide'
  },
  {
    id: 'impersonation',
    label: 'Impersonation',
    description: 'Pretending to be someone else or using a deceptive name'
  },
  {
    id: 'removal_request',
    label: 'Content / Privacy',
    description: 'Request removal of private, sensitive, or copyrighted content'
  },
  {
    id: 'misinformation',
    label: 'Misinformation',
    description: 'False claims, defamation, or election misinformation'
  },
  {
    id: 'other',
    label: 'Other Violation',
    description: 'Any other violation not covered above'
  }
] as const;

export type ReportReasonId = (typeof REPORT_REASONS)[number]['id'];

export const REPORT_REASON_IDS: ReadonlySet<string> = new Set(
  REPORT_REASONS.map(r => r.id)
);

export function isReportReasonId(value: unknown): value is ReportReasonId {
  return typeof value === 'string' && REPORT_REASON_IDS.has(value);
}

export function reportReasonLabel(id: string): string {
  return REPORT_REASONS.find(r => r.id === id)?.label ?? id;
}

export const REPORT_REASON_COLORS: Record<ReportReasonId, string> = {
  spam: 'var(--color-report-spam)',
  harassment: 'var(--color-report-harassment)',
  violence_or_illegal: 'var(--color-report-violence)',
  sexual_content: 'var(--color-report-sexual)',
  self_harm: 'var(--color-report-self-harm)',
  impersonation: 'var(--color-report-impersonation)',
  removal_request: 'var(--color-report-privacy)',
  misinformation: 'var(--color-report-misinformation)',
  other: 'var(--color-report-other)'
};

export function reportReasonColor(id: string): string {
  return REPORT_REASON_COLORS[isReportReasonId(id) ? id : 'other'];
}
