---
name: setup-idstead
description: Set up a new Idstead instance (personal site, admin portal, public API and jobs Workers on Cloudflare) from this repository with bun run setup. Use when the user asks to install, set up, deploy for the first time or bootstrap Idstead or their own copy of this site.
---

# Set up an Idstead instance

`tooling/setup.ts` (`bun run setup`) does the work. Your job is to collect the answers, get the dry run clean with the user, and run `apply` once they agree. Follow these steps in order and do not improvise other ways to create resources. The full reference is `docs/001-getting-started/README.md`; read it before you start.

## Rules

- **Never handle secret values.** Do not ask for API keys, tokens or passwords in chat, do not write them into files, and do not print the environment. Tell the user which variable names are missing and let them put the values in `.env` (repository root) or their secret manager themselves.
- **Dry run first.** `apply` creates Cloudflare resources (the R2 bucket, queues and the D1 database with its migrations), a Cloudflare Access application and policy for the admin host, the starter legal pages, and deploys four Workers. Run it only after the user has seen a clean dry run and said yes.
- **Use bun only** (`bun`, `bunx`), never npm, npx, yarn or pnpm.
- If the repository has a secret manager rule (for example `.claude/rules/phase.md`), run the commands through it, such as `phase run --env prod -- bun run setup`.

## Steps

1. **Check the basics.** Run `bun --version` and `bun install`. Check `bunx wrangler whoami`; if it is not signed in, ask the user to run `bunx wrangler login` themselves.
2. **Collect the answers** from the user: the domain of the public site (the admin portal and API default to `admin.<domain>` and `api.<domain>`), and the email address that may sign in to the admin. The account needs Cloudflare Zero Trust with a team name, and `CLOUDFLARE_API_TOKEN` (Access: Apps and Policies Write, Access: Organizations, Identity Providers, and Groups Read) plus `CLOUDFLARE_ACCOUNT_ID` in the environment. Ask whether they want other Worker, bucket or queue names than the defaults in `idstead.example.jsonc`.
3. **Write the answers file** outside the repository, or delete it afterwards:

    ```json
    { "domain": "example.com", "adminEmail": "you@example.com" }
    ```

    Add an `instance` object shaped like `idstead.jsonc` only for names the user chose.

4. **Dry run:** `bun run setup --answers=<file>`. It stops at the first problem. The usual ones:
    - _Missing variables_: give the user the list and the table in the setup doc, and wait until they say the values are set.
    - _Wrangler is not signed in_: step 1.
    - _D1 step fails_: report Wrangler's message. A missing permission usually means the Cloudflare API token lacks D1 edit rights; the user fixes the token, then runs the setup again (it resumes where it stopped).
5. **Repeat the dry run** until it reaches "Next steps", then show the user what it would change and ask for a go-ahead.
6. **Apply:** `bun run setup apply --answers=<file>`. The build and deploys take a few minutes. If a step fails, report the error. Do not delete what earlier steps created; running `apply` again resumes, because every step checks first.
7. **Hand over.** Tell the user to open the admin, sign in through Cloudflare Access with the admin email, and require two-factor authentication in Zero Trust. Walk them through the printed next steps. Delete the answers file if it is inside the repository.

## Done when

- The dry run shows no pending changes.
- `https://<domain>`, `https://admin.<domain>` (behind Cloudflare Access) and `https://api.<domain>/v1` answer.
- `idstead.jsonc` has `access.teamDomain` and `access.aud`, and the user has the list of next steps.
