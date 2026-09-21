# Privacy Policy

**Effective date:** 19 September 2026

This **Privacy Policy** explains what personal data is processed when you visit **https://fkp.my.id** (the "**Website**"), why it is processed, who else receives it, and what rights you have over it.

We aim to describe the Website's actual behaviour rather than a generic template. Where a control is weaker than it might appear, this document says so.

## 1. Controller Identity

The controller responsible for the processing described here is:

- **Farhan Kurnia Pratama**
- Palembang, Indonesia
- Email: [contact@fkp.my.id](mailto:contact@fkp.my.id)

No data protection officer has been appointed, as the scale of processing does not require one. Enquiries should be sent to the address above.

## 2. Scope and Legal Framework

This policy covers the Website, its public interface under `/api/v1`, and the forms it presents.

Processing is carried out in accordance with **Law of the Republic of Indonesia No. 27 of 2022 on Personal Data Protection** (the "**PDP Law**"). Because the Website is reachable from the European Economic Area and the United Kingdom, this policy also sets out the corresponding rights and legal bases under the **General Data Protection Regulation** ("**GDPR**") for Visitors to whom that regulation applies.

## 3. Personal Data We Process

**Technical request data.** Every request carries an IP address, a user agent string, and the requested URL. Your IP address is used transiently, in unhashed form and held only in memory, for the purpose of enforcing the request rate limit described in Section 15; it is discarded within sixty seconds and is not written to any database.

**Pseudonymised identifiers derived from your IP address.** Four features store a salted `SHA-256` hash of your IP address rather than the address itself. They differ in how long the resulting identifier remains stable, and it would be misleading to describe them all in one sentence:

- **Article view counting.** The stored value combines the current date with the hash, so the identifier changes every day and views cannot be correlated across days. It exists solely to avoid counting the same reader twice for the same article on the same day.
- **Article helpfulness votes.** The stored value is the hash alone, without a date component. It is therefore a stable pseudonym for as long as your IP address and our salt remain unchanged, and it exists to prevent repeat voting.
- **Comment reports.** The stored value is likewise the hash alone, retained with the report for abuse-prevention purposes.
- **Email subscriptions.** The stored value is the hash alone, recorded once when a subscription is requested, so that abusive sign-up attempts can be identified. See Section 18.

We cannot recover your IP address from these hashes, but the second and third are stable identifiers and are treated as personal data.

**Content you submit.** Comments and replies consist of a display name between two and fifty characters and a body of up to two thousand characters. **No email address, account, or registration is required or collected in order to comment.** No IP address is stored alongside a comment. Comment reports consist of a category, optional supporting text of up to five hundred characters, and the identifier of the comment concerned. Contact and feedback messages consist of the name, email address, message, and, for feedback, the page URL that you supply. If you subscribe to new-article notifications, your email address is stored, together with the hashed identifier described above and the user agent string sent by your browser; Section 18 describes that process in full.

**Preferences stored on your own device.** See Section 4.

## 4. Local Storage and Cookies

> [!IMPORTANT] **The Website sets no first-party cookie for Visitors.** Your preferences are kept in your browser's `localStorage`, which is never transmitted to us. A first-party session cookie is set on one path only, the administrator area at `/admin`, and only after the administrator signs in; it is never issued to Visitors browsing the public Website. The other cookies you may encounter are set by third parties, as listed at the end of this section.

The following entries are written to `localStorage` on your device. They remain on your device, are readable only by this Website, and can be erased at any time by clearing site data in your browser.

- `fkp_cookie_consent_v2` — your consent choices for the four signals described in Section 5.
- `fkp_ga4_retention_settings` — the analytics retention preference shown in the consent dialog. See the note in Section 5 regarding its effect.
- `theme` — your light, dark, or automatic appearance choice.
- `a11y_settings` — accessibility preferences such as font scale and dyslexia-friendly typeface.
- `fkp_content_font` — your reading typeface choice.
- `codeblock_prefs` — display preferences for code blocks.
- `fkp_search_history` — the last five entries you opened from the search dialog, kept so that the dialog can offer them again. This is a record of your activity on the Website, but it is stored only on your device and is never transmitted to us or to any third party.

Third-party cookies that may be set in your browser: `_ga` and `_ga_G-6HR3DKWZLF` by Google, only after you grant analytics consent; and `__cf_bm` together with `cf_clearance` by Cloudflare, in connection with bot management and the anti-abuse challenge described in Section 8.

## 5. Analytics: Google Tag Manager and Google Analytics 4

The Website loads a **Google Tag Manager** container, identifier `GTM-TSBRHB6V`, through which a **Google Analytics 4** property, identifier `G-6HR3DKWZLF`, is configured to run.

**Google Consent Mode v2** is implemented. Four signals are transmitted, and **all four default to `denied`** before you make any choice:

- `analytics_storage`
- `ad_storage`
- `ad_user_data`
- `ad_personalization`

Analytics measurement therefore does not begin until you grant consent through the banner. You may accept all signals, accept analytics only, or reject everything, and you may revisit that decision at any time by selecting "**Cookies**" in the Website footer or by opening the search dialog and choosing the cookie settings command. Withdrawing consent is as straightforward as granting it and takes effect immediately.

Analytics data associated with the property is retained by Google for fourteen months before automated deletion.

> [!NOTE] The consent dialog presents a data-retention selector. In the current implementation that selector records your preference in `localStorage` only; it does not reconfigure the retention period held by Google. We state this plainly rather than let the control imply an assurance it does not provide. If you wish the retention period changed, please contact us.

**Legal basis:** consent, under Article 20(1) of the PDP Law and Article 6(1)(a) GDPR.

## 6. Error Monitoring and Session Replay

The Website uses [Sentry](https://sentry.io/) for error monitoring, performance tracing, and session replay.

- Diagnostic reports are generated when an error occurs in your browser or on the server.
- Performance traces are collected for requests, so that slow paths can be identified.
- **Session replay is enabled.** Approximately ten percent of all sessions are recorded, and one hundred percent of sessions in which an error occurs are recorded. A replay reconstructs page structure, navigation, clicks, scrolling, and network timing.
- Replay recording runs with the vendor's default privacy settings, under which **text content and form input values are masked and media elements are blocked** before the recording leaves your browser. Sentry additionally observes the IP address from which a report is sent.

> [!WARNING] Sentry, including session replay, initialises independently of the cookie banner. The banner governs the Google Consent Mode signals described in Section 5; it does not switch Sentry off. If you object to session replay, please contact us at [contact@fkp.my.id](mailto:contact@fkp.my.id).

**Legal basis:** legitimate interests in maintaining the security, stability, and correct operation of the Website, under Article 20(2) of the PDP Law and Article 6(1)(f) GDPR.

## 7. Contact and Feedback Forms

The contact form on the home page and the form at [Feedback](https://fkp.my.id/feedback) are relayed by **FormSubmit**, a third-party form-to-email service operated from the United States.

- The contact form transmits the name, email address, and message you enter.
- The feedback form additionally transmits the page URL you are reporting.
- The address of the page you submitted from is transmitted to FormSubmit as the referring URL.

These messages are delivered to us as email. **They are not stored in the Website's database.** Their retention is therefore governed by our mailbox, as described in Section 12.

> [!NOTE] An anti-abuse challenge is displayed on these two forms, but in the current implementation its result is not verified on the server before the message is relayed. It should not be relied upon as a security control. The challenge is verified for comments, comment reports, newsletter subscription requests, and administrator sign-in, as described in Section 8.

**Legal basis:** consent, and the taking of steps at your request prior to contact, under Article 20(2)(a) of the PDP Law and Articles 6(1)(a) and 6(1)(b) GDPR.

## 8. Anti-Abuse Challenge

Comments, comment reports, newsletter subscription requests, and administrator sign-in are protected by [Cloudflare Turnstile](https://www.cloudflare.com/products/turnstile/). When the challenge is verified, your IP address is transmitted to Cloudflare as part of that verification.

**Legal basis:** legitimate interests in preventing spam and automated abuse, under Article 20(2) of the PDP Law and Article 6(1)(f) GDPR.

## 9. Automated Comment Moderation

When you submit a comment or reply, **your display name and the full text of your comment are transmitted to Cloudflare Workers AI** and evaluated by an automated content-safety model, Llama Guard 3.

The outcome of that evaluation determines, on its own, whether your comment is published. There is no human review step before publication.

> [!IMPORTANT] This is a decision taken by automated means. If your comment is withheld and you consider the decision wrong, you may contest it and obtain human review by reporting the comment through the kebab menu (⋮) or by writing to [contact@fkp.my.id](mailto:contact@fkp.my.id). This reflects your right under Article 22(3) GDPR and the corresponding provisions of the PDP Law.

**Legal basis:** legitimate interests in preventing the publication of unlawful or abusive material, under Article 20(2) of the PDP Law and Article 6(1)(f) GDPR.

## 10. Recipients and Sub-Processors

Personal data described in this policy may be processed by the following recipients, each acting on our behalf or as an independent controller in respect of its own services:

- **Cloudflare, Inc.** — hosting and content delivery, the anti-abuse challenge, request rate limiting, automated comment moderation through Workers AI, and object storage for downloadable documents.
- **Supabase, Inc.** — the database in which published Content, comments, reports, view counts, helpfulness votes, and email subscriptions are stored, and the authentication service used for the administrator area.
- **Google LLC** — tag management and analytics, subject to your consent.
- **Functional Software, Inc. (Sentry)** — error monitoring, performance tracing, and session replay.
- **FormSubmit** — relay of contact and feedback messages to our mailbox.
- **Resend (Plus Five Five, Inc.)** — delivery of the subscription confirmation and new-article emails described in Section 18, and of security notifications sent to the administrator.
- **GitHub, Inc.** — retrieval of public repository metadata displayed on the Website. This is a server-side request; your data is not sent to GitHub as part of it.

We do not sell personal data, and we do not disclose it to any other party except where required by law or necessary to establish, exercise, or defend a legal claim.

## 11. International Transfers

We are established in Indonesia. Several of the recipients listed in Section 10 process data outside Indonesia, principally in the United States and in the global edge networks operated by Cloudflare. Where personal data of Visitors in the European Economic Area or the United Kingdom is transferred to a country without an adequacy decision, that transfer relies on the standard contractual clauses or equivalent safeguards adopted by the relevant provider. Transfers of personal data outside Indonesia are made in accordance with Articles 56 and 57 of the PDP Law.

## 12. Retention

- **Rate-limiting records.** Held in memory only, for a maximum of sixty seconds.
- **View-counting identifiers.** Retained with the article view record; the identifier itself ceases to be linkable after the day on which it was created.
- **Helpfulness votes and comment reports.** Retained for as long as the associated article or comment remains published, and thereafter for as long as necessary for abuse prevention.
- **Comments and replies.** Retained until you request their removal, or until the associated article is withdrawn.
- **Contact and feedback messages.** Retained in our mailbox for as long as necessary to deal with the matter raised, and thereafter in accordance with ordinary correspondence practice.
- **Email subscriptions.** Retained until you unsubscribe. An unconfirmed subscription request is deleted within seven days by a scheduled job. On unsubscribing, the record is kept in a suppressed state so that the address is not re-added by mistake; ask us and it will be erased outright.
- **Analytics data.** Fourteen months, as described in Section 5.
- **Error reports and session replays.** Retained according to the retention period applicable to our Sentry plan, typically ninety days for replays and error events.

## 13. Your Rights

Subject to the conditions and exceptions in the applicable law, you have the right to:

- **be informed** about the processing of your personal data, and to **obtain access** to it (PDP Law Art. 5–6; GDPR Art. 15);
- **obtain rectification** of inaccurate or incomplete data (PDP Law Art. 7; GDPR Art. 16);
- **obtain erasure** of your data (PDP Law Art. 8; GDPR Art. 17), and in particular to have a comment removed as described in Section 14;
- **restrict** or **object to** processing carried out on the basis of legitimate interests, including session replay (PDP Law Art. 9; GDPR Arts. 18 and 21);
- **receive your data in a structured, commonly used, machine-readable format** and have it transmitted to another controller (PDP Law Art. 13; GDPR Art. 20);
- **withdraw consent** at any time, without affecting the lawfulness of processing carried out before withdrawal (PDP Law Art. 9(2); GDPR Art. 7(3));
- **not be subject to a decision based solely on automated processing** that produces legal or similarly significant effects, and to obtain human intervention as described in Section 9 (PDP Law Art. 10; GDPR Art. 22);
- **lodge a complaint** with a supervisory authority, as described in Section 19.

To exercise any of these rights, write to [contact@fkp.my.id](mailto:contact@fkp.my.id). We will respond without undue delay and, in any event, within the period prescribed by the applicable law. We may ask you for information sufficient to establish that the request concerns your own data.

## 14. Removing a Comment

Because comments are posted without an account, the practical identifier for a removal request is the Comment ID.

1. Open the kebab menu (⋮) on the comment concerned.
2. Choose **Copy Comment ID**, or choose **Report** and select the **removal request** ground.
3. If you proceed by email or through the [Feedback](https://fkp.my.id/feedback) form, include the Comment ID and your reasons, and send it to [contact@fkp.my.id](mailto:contact@fkp.my.id).

## 15. Security Measures

We apply, among others: transport encryption; a content security policy and associated response headers; restriction of the internal interface to same-origin requests; database row-level security; rate limiting of the public interface; a lockout after repeated failed administrator sign-in attempts, applied to both the originating address and the account; optional two-factor authentication and passkeys for the administrator account, enforced on the server and in the database; an email notification to the administrator when a password sign-in succeeds; and the salted hashing of IP addresses described in Section 3.

No system is perfectly secure, and we make no assurance that these measures will prevent every incident. Our vulnerability disclosure procedure is published at [Security Policy](https://fkp.my.id/security).

## 16. Children

The Website is not directed at children and does not knowingly solicit personal data from them. If you believe that a child has provided personal data through the Website, please contact us and we will delete it.

## 17. Public Files and Checksums

Documents offered for download may be accompanied by a `SHA-256` checksum. A checksum is a deterministic fingerprint of the file's contents. It lets you verify the file's integrity, contains no information about you, and its publication or use collects no data about the person downloading the file.

## 18. Email Subscriptions

You may ask to be notified by email when a new article is published. This is optional; nothing else on the Website depends on it.

**Confirmed opt-in.** Entering an address does not subscribe it. We store the address in a pending state and send one confirmation email. The subscription becomes active only when you open the link in that email. If the link is never opened, the pending record is deleted as described in Section 12. This exists so that your address cannot be added to the list by someone else.

**What is stored.** Your email address, a salted hash of the IP address the request came from, and your browser's user agent string. The hash and user agent are kept to identify abusive sign-up attempts. We do not track whether you open or click the emails we send.

**Unsubscribing.** Every email carries a one-click unsubscribe link and the standard `List-Unsubscribe` headers, so your mail client may also offer an unsubscribe button of its own. Unsubscribing requires no account, no password, and no reply from us, and takes effect immediately.

**Legal basis:** consent, under Article 20(1) of the PDP Law and Article 6(1)(a) GDPR. You may withdraw it at any time by unsubscribing, without affecting the lawfulness of anything sent beforehand.

## 19. Changes, Contact, and Complaints

We may revise this **Privacy Policy**. The revised version takes effect on publication, and the modification date shown alongside this document reflects the most recent revision.

Questions, requests, and objections should be addressed to [contact@fkp.my.id](mailto:contact@fkp.my.id).

If you consider that our processing infringes your rights, you may lodge a complaint with the competent authority in Indonesia under the PDP Law. Visitors in the European Economic Area or the United Kingdom may instead lodge a complaint with the supervisory authority of their habitual residence or place of work.
