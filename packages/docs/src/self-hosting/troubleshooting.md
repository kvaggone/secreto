# Troubleshooting

## Why do I see a warning about insecure connection?

Secreto relies on native browser crypto APIs to encrypt and decrypt notes securely with great performance.
These APIs are only available in secure contexts (HTTPS). If you are running the app in a non-secure context (HTTP), you will see a warning in the app:

```plaintext
Your connection is not secure, the app must be served over HTTPS to work properly. You won't be able to create or view notes. Learn more.
```

You may also see a warning in the browser console:

```plaintext
The Cross-Origin-Opener-Policy header has been ignored because the URL's origin was untrustworthy.
```

You will need to serve the app over HTTPS to use it properly.

## How do I check that an instance is healthy?

Two endpoints, both public and both cheap:

- `GET /api/ping` answers `{"status":"ok"}` as long as the process is serving requests.
- `GET /api/health` also reports the parts that can fail without the app noticing:

```json
{
  "status": "ok",
  "database": "not-configured",
  "email": {
    "status": "unknown",
    "lastFailureAt": null,
    "lastSuccessAt": null,
    "failures": 0,
    "deliveries": 0
  }
}
```

`database` is `ok`, `not-configured` when no `DATABASE_URL` is set, or `unavailable` when one is set but the server cannot be reached. Running without a database is supported, so `not-configured` is not a fault.

`email.status` is `unknown` until the instance has tried to send something, `degraded` while a send has failed in the last 15 minutes without a later one succeeding, and `ok` otherwise. Access-code emails are sent in the background and their errors are never returned to the caller, so this is the only way to see from outside that sending is broken — for instance when an API key is no longer authorised for the sender domain.

The endpoint answers `503` whenever `status` is `degraded`, so an uptime check can watch the status code alone. Counters are kept in memory and reset when the process restarts; no address and no provider message is ever exposed.
