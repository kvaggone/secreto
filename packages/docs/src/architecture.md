---
outline: deep
---

# Architecture & Deployment

This page explains how Secreto is put together — the monorepo layout, the
runtime model, where the production service runs, and every pipeline that ships
code.

## Design principle: the server never sees plaintext

Secreto is a fork of [Enclosed](https://github.com/CorentinTh/enclosed) built
around **end-to-end encryption performed on the client**:

- A note is encrypted **in the browser (or in the CLI)** before it is sent.
- The decryption key lives **only in the URL hash fragment** (everything after
  `#`), which browsers never transmit to the server.
- The server stores only the encrypted blob. Even with full database access, a
  note cannot be read without the link.

The same crypto primitives (`@secreto/crypto`) power the web app and the CLI, so
the guarantee holds everywhere. See [How it works](/how-it-works) for the
step-by-step cryptographic flow.

## Monorepo layout

Secreto is a [pnpm workspace](https://pnpm.io/workspaces). Each package has a
single responsibility:

| Package | Responsibility |
| --- | --- |
| `packages/crypto` | Crypto primitives (Web Crypto API): key derivation, AES-GCM. Browser + Node builds. |
| `packages/lib` | Note logic: encrypt/decrypt, serialization, URL hash fragments, API client. |
| `packages/app-client` | Frontend — the Vite single-page app served at [secreto.info](https://secreto.info). |
| `packages/app-server` | Backend — the [Hono](https://hono.dev) API under `/api/*`. |
| `packages/deploy-cloudflare` | Glue that bundles client + server into one Cloudflare Pages deployment. |
| `packages/cli` | `secreto-cli` — the terminal client published to npm. |
| `packages/docs` | This documentation site (VitePress). |

`crypto` and `lib` are workspace-only packages: they are never published to npm
on their own. The CLI **bundles** them into its output so it can be installed as
a self-contained package.

## Backend: one codebase, two runtimes

`app-server` is written with [Hono](https://hono.dev), a cross-runtime web
framework, and builds to **two targets** from the same source. The storage layer
is abstracted through [unstorage](https://unstorage.unjs.io), so the note logic
does not know or care where data physically lives.

| | Production (secreto.info) | Self-hosting |
| --- | --- | --- |
| Entry point | `src/index.cloudflare.ts` | `src/index.node.ts` |
| Runtime | **Cloudflare Workers** (edge) | Node.js 22 |
| Storage | **Cloudflare KV** | Filesystem (`unstorage` fs-lite) |
| Expiring notes | KV `expirationTtl` (automatic) | `node-cron` scheduled task |

## Where the production service runs

**secreto.info runs entirely on Cloudflare — there are no dedicated servers.**

- **Cloudflare Pages** serves the frontend static assets (`app-client`).
- **Cloudflare Workers** execute the `/api/*` backend at the edge. Which paths
  hit the Worker versus the static assets is declared in
  `packages/deploy-cloudflare/_routes.json`.
- **Cloudflare KV** (namespace binding `notes`) stores the encrypted notes with
  a per-note TTL.

### External services

Two managed services support features Secreto adds on top of Enclosed:

- **[Resend](https://resend.com)** (`api.resend.com`) — transactional email:
  one-time passcodes for the email access gate, plus "no access" notices.
  Configured with `RESEND_API_KEY` / `EMAIL_FROM`.
- **[Supabase](https://supabase.com) (Postgres)** — the global email
  suppression list (recipients who opted out), stored in a `suppressed_emails`
  table and reached via PostgREST with a service key. It is **fail-safe**: if
  Supabase is unconfigured or unreachable, addresses are simply treated as "not
  suppressed" so note creation never breaks. Configured with `SUPABASE_URL` /
  `SUPABASE_SERVICE_KEY`.

## Deployment pipelines

Five independent pipelines ship different parts of the project.

### 1. secreto.info (frontend + API) → Cloudflare Pages

The live site is a **Cloudflare Pages project connected to this Git
repository**. On every push to `main`, Cloudflare runs
`packages/deploy-cloudflare/build.sh`, which:

1. builds the Worker (`app-server` → esbuild bundle),
2. builds the client (`app-client` → Vite),
3. copies both plus `_routes.json` into `dist/`,

and then publishes the result. Merging a PR into `main` is all it takes to
deploy the website and API.

::: info
The repository-to-Cloudflare connection is configured in the Cloudflare
dashboard, not in the repo, so — unlike the three GitHub-hosted pipelines below
— this pipeline has no workflow file under `.github/workflows/`.
:::

### 2. Docker image → GHCR

`.github/workflows/docker.yml` builds a multi-arch (amd64 + arm64) image on
every push to `main` and on `v*` tags, and pushes it to
`ghcr.io/kvaggone/secreto`. This is what self-hosters run with `docker compose`.
See [Using Docker](/self-hosting/docker).

### 3. Documentation → GitHub Pages

`.github/workflows/docs.yml` builds and deploys this VitePress site to GitHub
Pages whenever `packages/docs/**` changes.

### 4. Release archive → GitHub Releases

`.github/workflows/release.yml` runs on `v*` tags: it builds the Node server and
client into a tarball and attaches it to a GitHub Release.

### 5. secreto-cli → npm (manual)

The CLI is published manually from the repo root:

```bash
pnpm install
pnpm --filter secreto-cli publish --access public
```

There is no automated CI pipeline for the CLI yet. Because `crypto` and `lib`
are bundled into the CLI at build time, the published package only depends on
real npm packages and installs cleanly outside the monorepo.

## Note lifecycle

1. The client (browser or CLI) encrypts the content and gets back an encrypted
   payload plus a key.
2. `POST /api/notes` stores the payload in KV with an `expirationTtl` equal to
   the chosen lifetime (1h / 1d / 1w / 1m).
3. The key is placed in the URL hash fragment and the link is handed to the
   sender.
4. The recipient opens the link; the frontend fetches the payload, takes the key
   from the `#` fragment, and decrypts it in the browser.
5. **Expiration:** in production, KV deletes the note automatically at TTL; when
   self-hosting on Node, a cron task (`delete-expired-notes`) prunes expired
   notes. **Burn-after-reading** notes are deleted immediately after the first
   read. In addition, the note view clears the displayed plaintext client-side
   the moment the live countdown reaches zero, even if the tab was left open.
