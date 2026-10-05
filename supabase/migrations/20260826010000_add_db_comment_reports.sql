CREATE TABLE IF NOT EXISTS public.db_comment_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  comment_id uuid NOT NULL REFERENCES public.db_comments(id) ON DELETE CASCADE,
  reason text NOT NULL,
  details text,
  reporter_ip_hash text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.db_comment_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view comment reports"
  ON public.db_comment_reports
  FOR SELECT
  TO authenticated
  USING (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
    OR (auth.jwt() ->> 'role') = 'service_role'
  );

CREATE POLICY "Admins can delete comment reports"
  ON public.db_comment_reports
  FOR DELETE
  TO authenticated
  USING (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
    OR (auth.jwt() ->> 'role') = 'service_role'
  );

-- Update terms content with comment removal procedure
UPDATE public.db_legals
SET content = REPLACE(
  content,
  '## 4. User Submissions & Moderation',
  '## 4. User Submissions, Moderation & Content Removal' || E'\n\n' ||
  'When submitting comments, feedback, or messages through forms on this site:' || E'\n\n' ||
  '- You warrant that your submissions do not contain illegal content, malware, spam, phishing links, or impersonating identities.' || E'\n' ||
  '- Submissions undergo automated and manual moderation (including Turnstile verification and AI moderation) prior to publication or response.' || E'\n' ||
  '- **Comment Removal & Takedown Requests**: If you wish to request the removal of a comment (for privacy, copyright, or inaccuracies), you can copy the Comment ID via the three-dot (⋮) menu on the comment bubble and submit a request via our [Feedback Form](/feedback) or email contact@fkp.my.id including the Comment ID and rationale.'
),
updated_at = now()
WHERE slug = 'terms' AND content LIKE '%## 4. User Submissions & Moderation%';

-- Update privacy content with right to erasure procedure
UPDATE public.db_legals
SET content = REPLACE(
  content,
  '## 5. Public Comments & Feedback',
  '## 5. Public Comments, Feedback & Right to Erasure' || E'\n\n' ||
  'Submissions made through the comment or feedback forms are stored securely. Public comments are moderated before display.' || E'\n\n' ||
  '- **Right to Erasure (Comment Deletion)**: You have the right to request deletion of comments containing your personal information. Use the "Copy Comment ID" option in the comment''s kebab menu (⋮) and submit a request via our [Feedback Form](/feedback) or via email to contact@fkp.my.id.'
),
updated_at = now()
WHERE slug = 'privacy' AND content LIKE '%## 5. Public Comments & Feedback%';
