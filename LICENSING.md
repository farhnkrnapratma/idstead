# Licensing

Idstead keeps software, site content and brand under separate terms. A license for one part never grants rights in another.

| Part | Paths | License |
| --- | --- | --- |
| Idstead source code | everything not listed below | [AGPL-3.0-only](LICENSE) |
| MDRS engine, DOM and editor | `packages/mdrs/**` | [MIT](packages/mdrs/LICENSE-MIT) OR [Apache-2.0](packages/mdrs/LICENSE-APACHE), at your option |
| Martian Mono and Paper Mono fonts | `packages/ui/src/fonts/*.woff2` | [OFL-1.1](packages/ui/src/fonts/MartianMono-OFL.txt) |
| EFF short wordlist | `packages/lib/src/data/password-words.json` | [CC-BY-4.0](packages/lib/src/data/password-words.LICENSE.md) |
| Third-party Claude Code skills | `.claude/skills/**`, `.agents/skills/**` | The license of each upstream project; see [Third-party skills](#third-party-skills) |
| Name, wordmark and logos | `brand/**` and every use of the Idstead name | All Rights Reserved; see [TRADEMARKS.md](TRADEMARKS.md) |

Every file carries an `SPDX-FileCopyrightText` and `SPDX-License-Identifier` header, or is covered by [`REUSE.toml`](REUSE.toml). The license texts are in [`LICENSES/`](LICENSES). Check compliance with:

```sh
uvx reuse lint
```

## Running a modified Idstead

The AGPL-3.0 applies to use over a network. If you modify Idstead and let people interact with it, you must offer them the corresponding source of your version (section 13). The site footer links to the source:

1. Publish your modified code in a public repository.
2. Set `source` in `idstead.jsonc` to that repository and run `bun run configure`.

An unmodified deployment can keep the default, which points at the upstream repository.

## Site content

Posts, banners, images, profile text and legal pages live in each instance's D1 database and R2 bucket, not in this repository. They belong to the person who runs that site, and Idstead claims no rights in them.

The site owner chooses the license for their content in the admin under **Settings → Content license**. A new instance defaults to All Rights Reserved. Each post can override the site license, and a post's banner can credit its origin:

| Banner origin | What the post shows |
| --- | --- |
| Own work | The post's license covers the banner. |
| Third party | The author, a link to the source and the banner's own license. The post's license does not cover it. |
| AI-generated | "AI-generated image; no license claimed." The post's license does not cover it. |

Credit images inside a post in their caption.

## Brand

The AGPL-3.0 grants no rights in the Idstead name, wordmark or logos (section 7(e)). [TRADEMARKS.md](TRADEMARKS.md) describes what is allowed without asking.

## Third-party skills

| Skills | Upstream | License |
| --- | --- | --- |
| `animate`, `animation-performance`, `animation-vocabulary`, `apple-design`, `break-ui`, `emil-design-eng`, `find-animation-opportunities`, `improve-animations`, `mobile-native`, `prototype`, `review-animations` | `emilkowalski/skill` | MIT |
| `cloudflare`, `turnstile-spin`, `web-perf`, `workers-best-practices`, `wrangler` | `cloudflare/skills` | Apache-2.0 |
| `security-audit` | `cloudflare/security-audit-skill` | MIT |
| `fallow`, `fallow-setup` | fallow | MIT |
| `task-observer` | see its `LICENSE.txt` | CC-BY-4.0 |
| `find-docs`, `graphify`, `svelte-code-writer`, `svelte-core-bestpractices`, `web-design-guidelines` | see `skills-lock.json` and each skill's source | Upstream terms (`LicenseRef-Upstream`) |

## Contributions

A contribution is licensed under the license of the path it changes: AGPL-3.0-only for Idstead code, MIT OR Apache-2.0 for `packages/mdrs/**`. See [CONTRIBUTING.md](CONTRIBUTING.md).
