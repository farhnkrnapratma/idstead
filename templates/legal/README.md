# Legal page templates

Starter texts for the legal pages every site serves: `/privacy`, `/terms`, `/security` and `/ai-disclosure`. A site reads these pages from the database (`db_legals`), not from these files; `bun run setup` adds them when a page is missing; otherwise copy a template into the admin portal's legal page editor and adapt it before publishing.

The first `# ` heading of a template is the page title: the setup script stores it as the title and removes it from the content, because the site shows the title above the page. Each template opens with an MDRS `:::define` block that fills in the owner's name, site URL, email and location from the author profile, so those details stay in one place. The rest of the text still describes one particular setup, and you must review all of it:

- **Jurisdiction.** The texts were written for an owner in Indonesia, under Law No. 27 of 2022 on Personal Data Protection, with GDPR rights for visitors in the European Economic Area and the United Kingdom. The governing law in `terms.md`, the supervisory authority and the international transfer sections in `privacy.md` change with your location.
- **Features.** The privacy policy lists every processor and every piece of data the full feature set uses: Google Analytics, Sentry, Resend for the newsletter and contact form, Turnstile, Cloudflare Workers AI for comment moderation, and the browser storage keys. Remove what your site does not use, and add anything you add.
- **Effective dates.** Set them to the day you publish.

These templates are not legal advice. Have them checked for your situation before relying on them.
