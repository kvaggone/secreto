# CLI

The Secreto CLI lets you create and read encrypted notes directly from your terminal or scripts. It publishes to [secreto.info](https://secreto.info) — all encryption happens client-side, the server never sees the plaintext.

## Installation

```bash
npm install -g secreto-cli
```

Once installed, use the `secreto` command.

## Sending a secret

```bash
secreto send "your secret text"
```

Returns a URL like:
```
https://secreto.info/s/AbCdEf#base64key
```

The `#fragment` is the decryption key — it never reaches the server. Share the full URL (including `#`) with the recipient.

### Options

| Flag | Description | Example |
|------|-------------|---------|
| `--ttl <duration>` | Expiry: `1h`, `24h`, `7d` (default: `7d`) | `--ttl 1h` |
| `--burn` | Delete after first read | `--burn` |
| `--password <pwd>` | Require password to decrypt | `--password hunter2` |

### Examples

```bash
# Burn-after-reading (one-time link)
secreto send "sk-proj-abc123..." --burn

# Short-lived + burn
secreto send "DATABASE_URL=postgres://..." --ttl 1h --burn

# Password-protected
secreto send "my-secret" --password hunter2
```

## Reading a secret

```bash
secreto get "https://secreto.info/s/AbCdEf#base64key"
```

If password-protected, add `--password`:

```bash
secreto get "https://secreto.info/s/AbCdEf#base64key" --password hunter2
```

## Using with AI agents (Cursor, Codex, Claude)

Add this to your system prompt or `.cursorrules`:

```
When you need to share a secret (API key, password, token) with the user,
use Secreto: run `secreto send "<value>" --burn` and share the resulting URL.
Never paste secrets directly in chat.
```

The agent can also receive secrets: ask the user to run `secreto send` on their end and paste the URL into chat — the agent calls `secreto get <url>` to decrypt it.

## Using stdin (pipe)

```bash
cat .env | secreto send --stdin
cat private-key.pem | secreto send --stdin --burn
```

## Source

The CLI is open source: [github.com/kvaggone/secreto](https://github.com/kvaggone/secreto) (`packages/cli`). Published on npm as [`secreto-cli`](https://www.npmjs.com/package/secreto-cli).
