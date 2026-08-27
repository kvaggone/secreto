---
outline: deep
---

# Docker Installation

Secreto can be easily installed and run using Docker. This method is recommended for users who want a quick and straightforward way to deploy their own instance of Secreto with minimal setup.

## Prerequisites

Before you begin, ensure that you have Docker installed on your system. You can download and install Docker from the [official Docker website](https://www.docker.com/get-started).

## Rootless and Non-rootless Docker Images

Secreto provides both rootless and non-rootless Docker images. The rootless image, tagged as `latest-rootless` or `<version>-rootless` (e.g., `1.16.0-rootless`), allows you to run the container without requiring root privileges. This is useful in environments where running containers as root is discouraged for security reasons.

The non-rootless image, tagged as `latest` or `<version>` (e.g., `1.16.0`), does not require binding the user in Docker commands and can be used in scenarios where root privileges are acceptable.

## Image Source

Secreto Docker images are published to the GitHub Container Registry (GHCR) at `ghcr.io/kvaggone/secreto`. Images are built for `linux/amd64` and `linux/arm64`.

## Basic Docker Run

To run Secreto using Docker, you can use the following command:

```bash
docker run -d --name secreto --restart unless-stopped -p 8787:8787 ghcr.io/kvaggone/secreto
```

This command will download the Secreto image and start the application, making it accessible at `http://localhost:8787`.

### Explanation of the Command

- `-d`: Runs the container in detached mode (in the background).
- `--name secreto`: Names the container "secreto" for easy identification.
- `--restart unless-stopped`: Configures the container to always restart unless it is explicitly stopped.
- `-p 8787:8787`: Maps port 8787 on your host to port 8787 in the container, making the application accessible on your local machine.
- `ghcr.io/kvaggone/secreto`: Specifies the Docker image to use.

## Docker with Volume Persistence

To ensure that your notes and settings are preserved even if the container is stopped or removed, you can run Secreto with volume persistence. Replace `/path/to/local/data` with the path to your local data directory:

```bash
docker run -d --name secreto --restart unless-stopped -p 8787:8787 -v /path/to/local/data:/app/.data ghcr.io/kvaggone/secreto
```

For the rootless image, you can use the following command (specifying the `latest-rootless` tag and the user ID and group ID):

```bash
docker run -d --name secreto --restart unless-stopped -p 8787:8787 -v /path/to/local/data:/app/.data --user $(id -u):$(id -g) ghcr.io/kvaggone/secreto:latest-rootless
```

### Explanation of Additional Flags

- `-v /path/to/local/data:/app/.data`: Maps a local directory to the container's data directory, ensuring that data is stored persistently on your host machine.
- `--user $(id -u):$(id -g)`: Ensures that the container runs with the same user ID and group ID as your current user, preventing potential permission issues with the mounted volume.

## Managing the Docker Container

Once Secreto is running in a Docker container, you can manage it using the following commands:

### Stopping the Container

To stop the Secreto container, run:

```bash
docker stop secreto
```

### Restarting the Container

To restart the container, use:

```bash
docker start secreto
```

### Removing the Container

If you need to remove the container, stop it first and then remove it with:

```bash
docker stop secreto
docker rm secreto
```

## Updating Secreto

To update your Secreto instance to the latest version, first remove the existing container, pull the latest image, and then run the container again:

```bash
docker stop secreto
docker rm secreto

docker pull ghcr.io/kvaggone/secreto

# Run the container again
docker run -d --name secreto --restart unless-stopped -p 8787:8787 -v /path/to/local/data:/app/.data ghcr.io/kvaggone/secreto
```

This will ensure that you are using the latest version of Secreto with all your previous data intact.

## Building the Image Yourself

If you prefer to build the image from source instead of pulling it:

```bash
git clone https://github.com/kvaggone/secreto.git
cd secreto

# Non-rootless image
pnpm docker:build

# Rootless image
pnpm docker:build:rootless
```

## Next Steps

Once you have Secreto up and running, you can explore [configuration options](./configuration) to customize your instance further. For more advanced setups, consider using [Docker Compose](./docker-compose) to manage your Secreto deployment.
