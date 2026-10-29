:::define
name: api.v1.author.profile.name
site: api.v1.author.profile.siteUrl
email: api.v1.author.profile.email
:::

# AI Disclosure

This **AI Disclosure** explains where **${site}** (the "**Website**") uses artificial intelligence, what it is used for, and where it is not used.

## 1. Authored Content

Every post, page and project description on the Website is written and published by **${name}**. The Website does not generate articles, summaries or other editorial content with AI.

## 2. Comment Moderation

Comments submitted on the Website are checked by an automated content-safety model, **Llama Guard 3**, operated on **Cloudflare Workers AI**, before they are published.

- The model receives the display name and the comment body. It does not receive your email address or IP address.
- The model only classifies the submission as safe or unsafe. It does not change the text.
- A submission the model marks as unsafe is held for review instead of being published. If the moderation service is unavailable, the submission is rejected rather than published unmoderated.

## 3. Agent Discovery Search

The Website offers a discovery API under `/api/ard` that lets AI agents find its public API operations. Search requests to that API are turned into text embeddings on Cloudflare Workers AI, so the closest entries can be returned. Only the search text is sent to the model.

## 4. Contact

Questions about how the Website uses AI may be sent to [${email}](mailto:${email}), or submitted through the [Feedback](/feedback) form.
