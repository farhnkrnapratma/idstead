# Terms of Service

**Effective date:** 8 September 2026

These **Terms of Service** (the "**Terms**") govern your access to and use of **https://fkp.my.id** (the "**Website**"), together with its content, its public application programming interface, and every related feature made available through it (collectively, the "**Service**"). The Service is operated by **Farhan Kurnia Pratama** ("**we**", "**us**", or "**our**").

By accessing, browsing, querying, or otherwise using the Service, you acknowledge that you have read, understood, and agree to be bound by these **Terms**. If you do not agree to these **Terms**, you must not use the Service.

## 1. Definitions

For the purposes of these **Terms**:

- "**Content**" means any text, article, source code, image, document, metadata, or other material made available through the Service.
- "**Public API**" means the read-only interface published under the `/api/v1` path prefix.
- "**Submission**" means any material you transmit to us through the Service, including blog comments, replies, comment reports, contact messages, feedback reports, and article helpfulness votes.
- "**Visitor**", "**you**", or "**your**" means any natural or legal person who accesses the Service.

## 2. Acceptance and Eligibility

You represent that you have the legal capacity to enter into a binding agreement in your jurisdiction. If you are below the age of majority applicable to you, you may use the Service only with the involvement of a parent or legal guardian.

Each point at which the Service accepts a Submission displays a notice stating that, by proceeding, you accept these **Terms** and our [Privacy Policy](https://fkp.my.id/privacy). Completing that action constitutes your acceptance.

## 3. Acceptable Use

You agree to use the Service only for lawful purposes and in accordance with these **Terms**. You must not:

- Attempt to breach, bypass, disable, or probe for vulnerabilities in any authentication, authorization, or access-control mechanism, except as expressly permitted under our [Security Policy](https://fkp.my.id/security).
- Conduct denial-of-service or distributed denial-of-service attacks, automated brute-force attempts, or request flooding that degrades availability for other Visitors.
- Circumvent, or attempt to circumvent, published rate limits, the directives published at `/robots.txt`, or any technical measure that restricts access to the Service.
- Submit or transmit malware, phishing links, spam, or any material that is unlawful, defamatory, harassing, or infringing.
- Impersonate any person or entity, or misrepresent your affiliation with any person or entity.
- Use the automated content-generation, translation, or moderation capabilities of the Service in a manner intended to overload them, extract the underlying models, or generate unlawful material.
- Scrape, harvest, or systematically retrieve Content by any means other than the Public API, or in excess of the limits described in Section 5.

## 4. Intellectual Property

**Source code.** Source code, components, and utilities that we publish as open source are licensed under the [**MIT License**](https://opensource.org/license/mit) unless a different licence is stated in the relevant repository.

**Written Content.** Blog posts, articles, documentation, illustrations, and other editorial material published on the Website remain the property of **Farhan Kurnia Pratama** and are protected by applicable copyright law. You may quote or reference such material for the purposes of commentary, criticism, reporting, teaching, or research, provided you give appropriate attribution and include a link to the original page. You may not republish substantial portions of the written Content without prior written permission.

**Your Submissions.** You retain ownership of your Submissions. By making a Submission that is intended for publication, you grant us a non-exclusive, worldwide, royalty-free licence to store, reproduce, display, and distribute that Submission through the Service, including through the Public API and syndication feeds. You may withdraw this licence by requesting removal in accordance with Section 7.

## 5. Public API

The Website exposes a public, read-only interface under `/api/v1`. Its full reference is published at `/api/v1` and in machine-readable form at `/.well-known/openapi.json` and `/.well-known/openapi.yaml`.

- **Read-only.** Every endpoint under `/api/v1` responds to `GET` only. No endpoint under that prefix accepts a request that modifies data.
- **Open access.** No authentication is required, and responses carry `Access-Control-Allow-Origin: *`, so the Public API may be called from any origin.
- **Rate limits.** Requests are limited to 60 per minute per IP address. Responses carry the `X-RateLimit-Limit`, `X-RateLimit-Remaining`, and `X-RateLimit-Reset` headers, and requests in excess of the limit receive HTTP `429` together with a `Retry-After` header.
- **Response formats.** Markdown output through `?format=md` or the `Accept: text/markdown` header is available on `/api/v1/blog`, `/api/v1/blog/{id_or_slug}`, and `/api/v1/author` only.
- **No service level.** The Public API is provided free of charge on an **"as is"** and **"as available"** basis, without any warranty, uptime commitment, or **Service Level Agreement**.
- **Versioning and change.** Breaking changes are published under a new version prefix such as `/api/v2` and are not applied in place to `/api/v1`. We may nevertheless modify, deprecate, throttle, or withdraw any endpoint at any time.

## 6. Submissions and Automated Moderation

You warrant that your Submissions are lawful, are not misleading as to their origin, and do not infringe the rights of any third party.

Comments and replies are subject to the following controls before publication:

- A [Cloudflare Turnstile](https://www.cloudflare.com/products/turnstile/) challenge must be completed and verified.
- Display names that impersonate the Website owner are rejected.
- Comment bodies may not contain hyperlinks of any form.
- The display name and body are evaluated by an automated content-safety model, Llama Guard 3, operated on Cloudflare Workers AI.

:::important Publication decisions for comments are **fully automated**. A comment is published if, and only if, the automated safety evaluation returns a favourable verdict; there is no human review queue before publication. A comment held back by that evaluation is stored but is never displayed and is never returned by the Public API. :::

If the automated moderation service is unavailable, the Submission is rejected with the error code `BLOG_COMMENT_MODERATION_UNAVAILABLE`. We do not fall back to publishing unmoderated material.

We may remove, edit, or refuse any Submission at our discretion, and we may withdraw access to the Service from any Visitor who breaches these **Terms**.

## 7. Reporting and Content Removal

Every published comment carries a kebab menu (⋮) offering a **Report** action and a **Copy Comment ID** action.

The report form accepts one of the following grounds: spam, harassment, violence or illegal activity, sexual content, self-harm, impersonation, **removal request**, misinformation, or other, together with optional supporting detail. Reports are the designated route for objecting to an automated publication decision, and each report is reviewed by a human.

If you wish to request removal of a comment on grounds of privacy, copyright, or factual inaccuracy, you may either submit a report using the **removal request** ground, or copy the Comment ID and send it, together with your reasons, through our [Feedback](https://fkp.my.id/feedback) form or by email to [contact@fkp.my.id](mailto:contact@fkp.my.id).

## 8. Automatically Generated and Machine-Translated Content

Parts of the Service produce or transform Content automatically. Translated Content requested through the `lang` query parameter is machine-generated and is flagged as such in API responses and accompanied by a disclaimer. Certain editorial drafts and document summaries are likewise produced with automated assistance.

Automatically generated and machine-translated Content is provided for convenience only. It may contain errors, omissions, or mistranslations, and it does not carry the same assurance of accuracy as the original text. Where a translation and the original conflict, the original prevails.

## 9. Document Integrity

Public curriculum vitae documents offered for download are accompanied by a `SHA-256` checksum, published both as a companion `.sha256` file and in the `X-Checksum-SHA256` response header. You may use that checksum to verify that a downloaded document has not been altered in transit or by a third party.

The checksum attests to file integrity only. It is not a warranty as to the accuracy, completeness, or currency of the document's contents.

## 10. Disclaimer of Warranties

THE SERVICE IS PROVIDED "AS IS" AND "AS AVAILABLE" WITHOUT WARRANTIES OF ANY KIND, WHETHER EXPRESS, IMPLIED, STATUTORY, OR OTHERWISE. TO THE FULLEST EXTENT PERMITTED BY APPLICABLE LAW, WE DISCLAIM ALL WARRANTIES, INCLUDING THE IMPLIED WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, TITLE, AND NON-INFRINGEMENT, AND ANY WARRANTY THAT THE SERVICE WILL BE UNINTERRUPTED, TIMELY, SECURE, OR ERROR-FREE.

## 11. Limitation of Liability

TO THE FULLEST EXTENT PERMITTED BY APPLICABLE LAW, IN NO EVENT SHALL **Farhan Kurnia Pratama** BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, EXEMPLARY, OR PUNITIVE DAMAGES, OR FOR ANY LOSS OF PROFITS, REVENUE, DATA, GOODWILL, OR BUSINESS OPPORTUNITY, ARISING OUT OF OR IN CONNECTION WITH YOUR USE OF, OR INABILITY TO USE, THE SERVICE, WHETHER BASED IN CONTRACT, TORT, STRICT LIABILITY, OR ANY OTHER LEGAL THEORY, AND WHETHER OR NOT WE HAVE BEEN ADVISED OF THE POSSIBILITY OF SUCH DAMAGES.

Nothing in these **Terms** excludes or limits liability that cannot lawfully be excluded or limited, including liability for death or personal injury caused by negligence, or for fraud.

## 12. Indemnity

You agree to indemnify and hold harmless **Farhan Kurnia Pratama** against any claim, demand, loss, liability, or expense, including reasonable legal fees, arising out of your Submissions, your use of the Service, or your breach of these **Terms** or of any applicable law.

## 13. Changes to These Terms

We may revise these **Terms** at any time. The revised version takes effect when it is published on this page, and the modification date shown alongside this document reflects the most recent revision. Where a change is material, we will use reasonable efforts to make it prominent. Your continued use of the Service after a revision constitutes acceptance of the revised **Terms**.

## 14. Governing Law and Jurisdiction

These **Terms** are governed by and construed in accordance with the laws of the **Republic of Indonesia**, without regard to its conflict-of-laws provisions. The courts of the Republic of Indonesia shall have jurisdiction over any dispute arising out of or in connection with these **Terms**.

Where you access the Service as a consumer resident in another jurisdiction, this clause does not deprive you of the protection of mandatory provisions of the law of your place of residence.

## 15. Severability and Waiver

If any provision of these **Terms** is held to be invalid, illegal, or unenforceable, that provision shall be severed and the remaining provisions shall continue in full force and effect. Our failure to enforce any provision shall not constitute a waiver of that provision or of any other.

## 16. Contact

Questions regarding these **Terms** may be sent to [contact@fkp.my.id](mailto:contact@fkp.my.id), or submitted through the [Feedback](https://fkp.my.id/feedback) form.
