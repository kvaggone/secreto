# secreto-cli

CLI for [Secreto](https://secreto.info) — send and receive end-to-end encrypted notes from your terminal.

Notes are encrypted client-side before being sent. The server only ever sees ciphertext; the decryption key lives exclusively in the URL fragment and never leaves your machine.

## Install

```bash
npm install -g secreto-cli
```

## Usage

### Send a note

```bash
# Send text directly
secreto send "Hello, world!"

# Send a file
secreto send --file secret.txt

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

### Version

```bash
secreto --version
```
