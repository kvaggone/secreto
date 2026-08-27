# Deploy on other platforms

Secreto is distributed as a standard OCI container image, so it runs on any platform that can pull and run a Docker image. Point your platform of choice at:

```
ghcr.io/kvaggone/secreto:latest
```

Expose port `8787` and mount a volume at `/app/.data` for persistent storage. See the [configuration guide](./configuration) for the available environment variables.

## Platforms with one-click templates

> [!INFO]
> Secreto is not yet packaged in any app store or one-click template catalogue (Railway, umbrelOS, Cloudron, RunTipi, Unraid, CasaOS). Templates published for the upstream [Enclosed](https://github.com/CorentinTh/enclosed) project deploy Enclosed, **not** Secreto — they do not include Secreto's email access gate, suppression list, or other additions.

To run Secreto on those platforms today, use their generic "deploy from a Docker image" option with the image above.

## Cloudflare Workers

The repository includes a `@secreto/deploy-cloudflare` package for deploying to Cloudflare Workers with a KV-backed storage driver.

## Another platform?

If you would like to see Secreto packaged for another platform, please open an issue on the [GitHub repository](https://github.com/kvaggone/secreto/issues/new/choose) with the details of the platform you would like to see supported.
