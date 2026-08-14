-- Migration: legal_pages
-- Created: 2026-08-09
-- Purpose: Table and SECURITY DEFINER RPC to store and manage site legal pages (privacy, security, terms)

CREATE TABLE IF NOT EXISTS public.legal_pages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text UNIQUE NOT NULL,
  title text NOT NULL,
  content text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.legal_pages ENABLE ROW LEVEL SECURITY;

-- Allow public read access
CREATE POLICY "Public read legal pages"
  ON public.legal_pages
  FOR SELECT
  TO public
  USING (true);

-- Allow authenticated users to insert/update/delete
CREATE POLICY "Authenticated users manage legal pages"
  ON public.legal_pages
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Atomic save RPC function
CREATE OR REPLACE FUNCTION public.save_legal_page(
  p_slug text,
  p_title text,
  p_content text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  INSERT INTO public.legal_pages (slug, title, content, updated_at)
  VALUES (p_slug, p_title, p_content, now())
  ON CONFLICT (slug)
  DO UPDATE SET
    title = EXCLUDED.title,
    content = EXCLUDED.content,
    updated_at = now();
END;
$$;

REVOKE ALL ON FUNCTION public.save_legal_page(text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.save_legal_page(text, text, text) TO authenticated;

-- Seed initial database entries for privacy, security, and terms
INSERT INTO public.legal_pages (slug, title, content)
VALUES
  (
    'privacy',
    'Privacy Policy',
    '# Privacy Policy

This Privacy Policy explains how personal data and technical analytics are handled when you visit **fkp.my.id** ("this website").

## 1. Overview & Data Transparency

We respect your privacy and process personal data in compliance with general privacy best practices. We only collect the minimal information necessary to deliver, secure, and improve our services.

## 2. Google Analytics 4 & Consent Mode v2

This website uses Google Analytics 4 (GA4) with Google Consent Mode v2 enabled to measure traffic and user interactions.

- **Necessary Cookies**: Essential for security and saving your cookie consent preferences.
- **Analytics & Personalization Cookies**: Only loaded after explicit consent via the cookie banner.

## 3. Data Retention Policy

Analytics data sent to GA4 is retained for a maximum of 14 months before automated deletion.

## 4. Error Monitoring & Performance Tracking (Sentry)

Sentry is used to capture runtime client errors for debugging. No personal passwords or sensitive tokens are transmitted to Sentry.

## 5. Public Comments & Feedback

Submissions made through the comment or feedback forms are stored securely. Public comments are moderated before display.

## 6. Your Choices & Cookie Preferences

You can customize or withdraw your consent at any time by clicking "Manage cookies" in the website footer.

## 7. Contact Information

If you have any questions about this Privacy Policy, please reach out via [contact@fkp.my.id](mailto:contact@fkp.my.id).'
  ),
  (
    'security',
    'Security Policy',
    '# Security Policy

This is the personal website and API for Farhan Kurnia Pratama (fkp.my.id) — a SvelteKit app with a Supabase backend, deployed to Cloudflare Pages, and a public read-only REST API under `/api/v1`.

## Scope

Only the code and infrastructure in this repository and its live deployment at fkp.my.id are in scope. There are no separately maintained release branches or versions to track — the `main` branch is what''s deployed, and that''s the only version supported for security fixes.

Areas of particular interest:

- Authentication and admin access (`/admin`, `/api/internal/admin/*`, Supabase Auth)
- Row Level Security (RLS) policies and any service-role (`supabaseAdmin`) code path
- The public API (`/api/v1/**`) — input validation, rate limiting, CORS
- The internal API (`/api/internal/**`) — comment submission, view counting, and admin auth/CV endpoints; same-origin enforcement, Turnstile + AI moderation pipeline

Out of scope: findings that require physical access, social engineering, or third-party services this project doesn''t control (Cloudflare, Supabase, Sentry infrastructure itself).

## Reporting a Vulnerability

**Preferred: GitHub Private Vulnerability Reporting.** This repository has it enabled — go to the Security tab on GitHub and click "Report a vulnerability." This keeps the report private until a fix is ready and lets us coordinate disclosure through GitHub''s tooling.

**Alternative:** email [contact@fkp.my.id](mailto:contact@fkp.my.id) with details. Please don''t open a public GitHub issue for a suspected vulnerability.

Please include:

- A description of the vulnerability and its potential impact
- Steps to reproduce (a proof-of-concept is appreciated but not required)
- Any relevant request/response details (redact your own personal data first)

## What to Expect

This project is maintained by a single person, not a security team, so response times are best-effort:

- **Acknowledgment**: within a few days of report
- **Triage/validation**: as soon as reasonably possible after acknowledgment
- **Fix and disclosure**: timeline depends on severity; critical issues (auth bypass, RLS bypass, data exposure) are prioritized

Please give a reasonable amount of time to investigate and patch before any public disclosure.

## Recognition

There''s no formal bug bounty program, but valid reports are credited (with permission) in the fix''s commit message or release notes.'
  ),
  (
    'terms',
    'Terms of Service',
    '# Terms of Service

Welcome to **fkp.my.id** ("the Website" or "the Service"), operated by Farhan Kurnia Pratama. By accessing or using this website, its content, or public API endpoints, you agree to be bound by these Terms of Service.

## 1. Acceptable Use

You agree to use the Website and its public services only for lawful purposes and in accordance with these Terms. You must not:

- Attempt to breach, bypass, or test vulnerabilities of authentication systems without explicit prior written consent (see our [Security Policy](/security)).
- Perform Denial of Service (DoS/DDoS) attacks, automated brute-force attempts, or excessive request flooding that impairs availability for other users.
- Use automated scraping tools in a manner that bypasses published rate limits or robots.txt directives.

## 2. Open Source & Intellectual Property

- **Open Source Code**: Code repositories, components, and open-source utilities published on this site are distributed under the MIT License unless stated otherwise.
- **Written Content & Articles**: Blog posts, articles, documentation, and graphics authored on this site are owned by Farhan Kurnia Pratama and protected by copyright law. You may quote or reference content with appropriate attribution and a link back to the original page.

## 3. Public REST API (/api/v1) Usage

The Website provides a public, read-only REST API under `/api/v1`.

- **Fair Use & Rate Limits**: Public API requests are subject to rate limiting to maintain service stability.
- **No SLA**: The API is provided free of charge on an "as is" and "as available" basis without any warranty or service level agreement (SLA).
- **Service Changes**: We reserve the right to modify, deprecate, or impose rate limits on API endpoints at any time.

## 4. User Submissions & Moderation

When submitting comments, feedback, or messages through forms on this site:

- You warrant that your submissions do not contain illegal content, malware, spam, or malicious scripts.
- Submissions undergo automated and manual moderation (including Turnstile verification) prior to publication or response.

## 5. Disclaimer of Warranties & Limitation of Liability

THE WEBSITE AND SERVICES ARE PROVIDED "AS IS" AND "AS AVAILABLE" WITHOUT WARRANTIES OF ANY KIND, EITHER EXPRESS OR IMPLIED. TO THE FULLEST EXTENT PERMITTED BY LAW, FARHAN KURNIA PRATAMA DISCLAIMS ALL WARRANTIES, INCLUDING MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, AND NON-INFRINGEMENT.

IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES ARISING FROM YOUR USE OF OR INABILITY TO USE THIS WEBSITE OR API.

## 6. Modifications to Terms

We reserve the right to update or modify these Terms of Service at any time. Any changes will be posted on this page with an updated modification date.

## 7. Contact Information

For any questions or inquiries regarding these Terms, please contact us at [contact@fkp.my.id](mailto:contact@fkp.my.id).'
  )
ON CONFLICT (slug) DO NOTHING;
