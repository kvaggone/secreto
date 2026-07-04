---
outline: deep
---

# Secreto

**Secreto** is a secure, end-to-end encrypted platform for sending private notes. Share sensitive information with confidence — notes are encrypted client-side and the server never sees your content.

## Key Features

- **End-to-End Encryption**: Notes are encrypted in the browser using AES-GCM 256-bit. The decryption key lives only in the URL fragment and never reaches the server.
- **Email Gate**: Restrict note access to specific email addresses with OTP verification.
- **Zero Knowledge**: The server stores only ciphertext — it cannot read your notes.
- **Configurable Security**: Set a password, define expiration (TTL), and enable self-destruct after reading.
- **File Attachments**: Share files securely alongside your notes.
- **CLI**: Create and retrieve notes directly from your terminal with `secreto send` / `secreto get`.
- **Self-Hostable**: Run your own Secreto instance for full control.
- **Open Source**: Available under the Apache 2.0 License.
- **Responsive Design**: Works on all devices.
- **Dark Mode**: Comfortable in any lighting.

## Get Started

Try it at [secreto.info](https://secreto.info) or [self-host your own instance](./self-hosting/docker).
