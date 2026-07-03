# Secreto

Share secrets safely. End-to-end encrypted notes that self-destruct — now with email access gates and more.

**Live service:** [secreto.info](https://secreto.info)

---

## What is Secreto?

Secreto is a fork of [Enclosed](https://github.com/CorentinTh/enclosed) (v1.16.0, MIT) — a beautiful open-source tool for sharing end-to-end encrypted notes. The server never sees your plaintext; the decryption key lives only in the URL fragment.

We took Enclosed and added features that matter for real-world use, with more on the way.

---

## What's new vs Enclosed

### Email access gate (OTP)
Lock a note to specific recipients. When you create a note you can enter one or more email addresses — only those people can open it. They receive a 6-digit one-time code by email to unlock the note. No account needed; just click the link and check your inbox.

### Unsubscribe / suppression list
Recipients can opt out of ever receiving Secreto codes. We respect that. Opted-out addresses are suppressed globally, so even if someone sends them a gated note they won't get spammed.

### Live expiration countdown
The note view page shows a live ticking countdown to when the note expires, so recipients know exactly how long they have.

### "Open note" button on the success page
After creating a note you see an "Open note" button right there — no need to paste the link into a new tab. (Hidden for burn-after-reading notes, since opening it yourself would destroy it.)

### Mobile-optimized layout
The whole UI has been tuned for small screens. Creating and reading notes on a phone works the way you'd expect.

---

## What's coming

- Continued UI/UX improvements — we're not done yet
- **secreto-cli** — a command-line tool to create and read notes from your terminal (coming soon)
- AI integrations — smart features that fit naturally into the encrypted-note workflow

---

## Self-hosting

You need Docker and Docker Compose.

```bash
git clone https://github.com/your-org/secreto.git
cd secreto
docker compose up -d
```

The app runs on port 8787 behind Caddy (ports 80/443 with automatic TLS). Edit `docker-compose.yml` to set your domain and other options:

```yaml
environment:
  PUBLIC_SITE_URL: https://your-domain.com
```

See [Enclosed's configuration docs](https://docs.enclosed.cc/self-hosting/configuration) for the full list of environment variables — they all work here too.

---

## License

Secreto is based on [Enclosed](https://github.com/CorentinTh/enclosed) by Corentin Th, licensed under the [MIT License](LICENSE).
