# GetQuick Ops

`gq` is a path-aware, read-only CLI for inspecting Ploi and Cloudflare resources associated with a project.

Run it from any directory inside a configured repository. It walks upward to find `getquick.ops.json`, loads that project's identifiers, and resolves project paths against the configuration directory rather than the CLI installation directory.

## Status

The initial release is intentionally read-only. It can inspect Ploi servers/sites and Cloudflare accounts/zones/DNS records. It does not deploy, change DNS, modify infrastructure, or transfer databases.

## Requirements

- Node.js 22.12 or newer
- A Ploi API token and/or Cloudflare API token with the minimum read permissions needed by the commands you use

## Install

Until an npm release is published, install directly from GitHub:

```bash
pnpm add --global github:Quick-Release/getquick-ops
```

For reproducible automation, pin the package in each project as well:

```bash
pnpm add --save-dev github:Quick-Release/getquick-ops
```

```json
{
  "scripts": {
    "ops": "gq"
  }
}
```

## Configure a project

Add `getquick.ops.json` at the repository root:

```json
{
  "project": "example-project",
  "ploi": {
    "serverId": "12345",
    "siteId": "67890"
  },
  "cloudflare": {
    "accountId": "0123456789abcdef0123456789abcdef",
    "zoneId": "abcdef0123456789abcdef0123456789",
    "zoneName": "example.com"
  }
}
```

Provider resource IDs are safe project configuration and can normally be committed. Do not put API tokens in this file.

See [`examples/getquick.ops.json`](examples/getquick.ops.json).

## Credentials and precedence

The CLI reads credentials and optional identifier overrides from:

1. Machine configuration: `${XDG_CONFIG_HOME:-~/.config}/getquick/ops.env`
2. Project-local `.env`
3. The process environment
4. Explicit CLI flags for resource identifiers

Later sources take precedence. Typical machine configuration:

```dotenv
PLOI_API_TOKEN=...
CLOUDFLARE_API_TOKEN=...
```

A project `.env` can provide these optional values when they are not committed in `getquick.ops.json`:

```dotenv
PLOI_SERVER_ID=12345
PLOI_SITE_ID=67890
CLOUDFLARE_ACCOUNT_ID=0123456789abcdef0123456789abcdef
CLOUDFLARE_ZONE_ID=abcdef0123456789abcdef0123456789
CLOUDFLARE_ZONE_NAME=example.com
```

Keep both credential files out of version control and restrict their filesystem permissions.

## Commands

```bash
gq context show
gq context show --json

# Ploi
gq ploi servers list
gq ploi server show
gq ploi sites list
gq ploi site show

# Cloudflare
gq cloudflare accounts list
gq cloudflare zones list
gq cloudflare zone show
gq cloudflare dns list
gq cloudflare dns list --name www.example.com --type A
```

Resource flags override project configuration:

```bash
gq ploi site show --server 12345 --site 67890
gq cloudflare dns list --zone abcdef0123456789abcdef0123456789
```

Select a project when running elsewhere:

```bash
gq --project /path/to/project ploi site show
gq --config /path/to/project/getquick.ops.json context show
```

Use `--json` with any command for machine-readable output.

## How project discovery works

1. Start at the current working directory.
2. Resolve it to its canonical path.
3. Walk upward until `getquick.ops.json` is found, stopping at the nearest Git repository root.
4. Treat that file's directory as the project root.
5. Load the project `.env` and data-only JSON configuration.
6. Resolve all project-relative paths from the project root.

Directory names never select infrastructure resources. A command refuses to run if it cannot find explicit project configuration.

## Development

```bash
pnpm install
pnpm check
```

## Security

Please report vulnerabilities privately through GitHub's security advisory interface rather than opening a public issue.

## License

[MIT](LICENSE)
