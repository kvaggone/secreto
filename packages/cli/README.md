# secreto-cli

CLI for [Secreto](https://secreto.info) — send and receive end-to-end encrypted notes from your terminal.

Notes are encrypted client-side before being sent. The server only ever sees ciphertext; the decryption key lives exclusively in the URL fragment and never leaves your machine.

## Install

```bash
npm install -g secreto-cli
```

Requires Node.js 18 or newer.

## Usage

### Send a note

```bash
# Send text directly
secreto send "Hello, world!"

# Send a file
secreto send --file secret.txt

# Pipe content in (keeps the secret out of the shell history)
cat .env | secreto send --stdin

# Set expiration (1h | 1d | 1w | 1m, default: 1d)
secreto send --ttl 1h "Expires in an hour"

# Burn after reading (delete on first view)
secreto send --burn "This self-destructs"

# Add password protection (prompts if you omit the value)
secreto send --password "my-pass" "Protected note"
secreto send --password "Combined options" --ttl 1w --burn
```

The command prints a shareable URL like:

```
https://secreto.info/abc123#dar:encryptionKey
```

### Fetch a note

```bash
# Fetch and print a note
secreto get "https://secreto.info/abc123#encryptionKey"

# Provide password directly (or omit to be prompted)
secreto get --password "my-pass" "https://secreto.info/abc123#pw:encryptionKey"
```

### Using another instance

By default the CLI talks to `https://secreto.info`. For a self-hosted instance, pass `--instance` or set `SECRETO_INSTANCE_URL`:

```bash
secreto send "Hello" --instance https://secreto.example.com
SECRETO_INSTANCE_URL=https://secreto.example.com secreto send "Hello"
```

`secreto get` takes the instance from the note URL, so notes from any instance work without extra flags.

### Version

```bash
secreto --version
```

## Troubleshooting

If a command fails to reach the instance, the CLI explains what went wrong (DNS, refused connection, timeout or TLS). Things to check:

- Node.js 18 or newer: `node --version`
- the instance is reachable: `curl -sS -o /dev/null -w "%{http_code}\n" https://secreto.info/api/ping`
- proxies: Node.js ignores `HTTP_PROXY`/`HTTPS_PROXY` unless you run Node 24+ with `NODE_USE_ENV_PROXY=1`
