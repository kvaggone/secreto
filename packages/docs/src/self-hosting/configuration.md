<script setup>
import { data } from '../data/configuration.data.ts'
</script>

# Self-Host Configuration

Configuring your self-hosted instance of Secreto allows you to customize the application to better suit your environment and requirements. This guide covers the key environment variables you can set to control various aspects of the application, including port settings, security options, and storage configurations.

## Environment Variables

Secreto is configured primarily through environment variables. Below is a list of the available variables, along with their descriptions and default values.

<div v-html="data" />

## Email Access Gate (OTP)

The email access gate sends one-time codes and "no access" notices via [Resend](https://resend.com). These are configured with the following variables (read directly from the environment):

| Environment variable | Documentation |
| --- | --- |
| `RESEND_API_KEY` | Resend API key used to send access-gate emails. Required for the email gate to work; without it, sending fails. |
| `EMAIL_FROM` | Sender identity for access-gate emails, in the form `Name <address@domain>`. The domain must be verified in your Resend account. Default value: `SECRETO.INFO <noreply@secreto.info>`. |
| `UNSUBSCRIBE_SECRET` | Secret used to sign one-click unsubscribe links. Falls back to `RESEND_API_KEY` if unset. |

## Optional: Native HTTPS Configuration

If you want to use HTTPS without a reverse proxy, you can set the `SERVER_USE_HTTPS` environment variable to `true` and provide the necessary certificate and key files.

You can either use a single PFX file or separate key and certificate files. If you use separate files, you can provide the `SERVER_HTTPS_KEY`, `SERVER_HTTPS_CERT`, and `SERVER_HTTPS_CA` environment variables. If you use a PFX file, you can provide the `SERVER_HTTPS_PFX` and `SERVER_HTTPS_PASSPHRASE` environment variables.

To generate the necessary key and certificate files, you can use the following command:

```bash
openssl req -x509 -newkey rsa:2048 -nodes -sha256 -subj '/CN=localhost' -keyout private-key.pem -out certificate.pem
```

And if you want to generate a PFX file, you can use the following command:

```bash
openssl pkcs12 -certpbe AES-256-CBC -export -out test_cert.pfx -inkey private-key.pem -in certificate.pem -passout pass:sample
```

## Applying Configuration Changes

To apply your configuration changes, ensure that you have exported the environment variables in your shell or included them in your environment configuration file. Then, restart your Secreto instance to apply the changes.

For Docker deployments, you can pass the environment variables directly when running the container:

```bash
docker run \
    -d --name secreto \
    --restart unless-stopped \
    -p 8787:8787 \
    -v /path/to/local/data:/app/.data \
    -e SERVER_CORS_ORIGINS="https://example.com" \
    ghcr.io/kvaggone/secreto
```

## Next Steps

Once your instance is configured, you can proceed to explore advanced deployment options or set up monitoring to ensure your Secreto instance runs smoothly. For a more complex setup, consider using [Docker Compose](./docker-compose) or deploying on a cloud provider.
