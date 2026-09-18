# gq Ops

`gq` is a path-aware, interactive CLI for managing Ploi resources and inspecting Cloudflare resources associated with a project.

Run it from any directory inside a configured repository. It walks upward to find `gq.ops.json`, loads that project's identifiers, and resolves project paths against the configuration directory rather than the CLI installation directory.

## Status

The CLI exposes all 225 operations currently documented in the Ploi API reference. Existing convenience commands inspect Ploi servers/sites and Cloudflare accounts/zones/DNS records; the catalog-driven `ploi api` commands also support Ploi mutations. Cloudflare commands remain read-only.

Run `gq` without arguments in a terminal to open the Clack-powered command picker and searchable Ploi operation browser. Scripted and JSON-oriented usage remains non-interactive.

## Requirements

- Node.js 22.12 or newer
- A Ploi API token and/or Cloudflare API token with the minimum read permissions needed by the commands you use

## Install

Until an npm release is published, install directly from GitHub:

```bash
pnpm add --global github:Quick-Release/gq-ops#v0.1.0
```

For reproducible automation, pin the package in each project as well:

```bash
pnpm add --save-dev github:Quick-Release/gq-ops#v0.1.0
```

```json
{
  "scripts": {
    "ops": "gq"
  }
}
```

## Configure a project

Add `gq.ops.json` at the repository root:

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

See [`examples/gq.ops.json`](examples/gq.ops.json).

## Credentials and precedence

The CLI reads credentials and optional identifier overrides from:

1. Machine configuration: `${XDG_CONFIG_HOME:-~/.config}/gq/ops.env`
2. Project-local `.env`
3. The process environment
4. Explicit CLI flags for resource identifiers

Later sources take precedence. Typical machine configuration:

```dotenv
PLOI_API_TOKEN=...
CLOUDFLARE_API_TOKEN=...
```

A project `.env` can provide these optional values when they are not committed in `gq.ops.json`:

```dotenv
PLOI_SERVER_ID=12345
PLOI_SITE_ID=67890
CLOUDFLARE_ACCOUNT_ID=0123456789abcdef0123456789abcdef
CLOUDFLARE_ZONE_ID=abcdef0123456789abcdef0123456789
CLOUDFLARE_ZONE_NAME=example.com
```

Keep both credential files out of version control and restrict their filesystem permissions.

Projects may define an interactive credential specification in `gq.ops.json`:

```json
{
  "credentials": {
    "envFile": ".env",
    "fields": [
      { "name": "PLOI_API_TOKEN", "secret": true },
      { "name": "CLOUDFLARE_API_TOKEN", "secret": true }
    ]
  }
}
```

Run `gq credentials configure` from the project to prompt for missing values and
save them with mode `0600`. Existing values are preserved unless
`--replace-existing` is supplied.

A project can also define a GitHub Actions environment in `gq.ops.json`:

```json
{
  "github": {
    "repository": "Quick-Release/example-project",
    "environment": "production",
    "secrets": ["CLOUDFLARE_API_TOKEN"],
    "variables": ["CLOUDFLARE_ACCOUNT_ID"]
  }
}
```

Use `gq github actions sync --dry-run` to inspect names, or
`gq github actions sync --yes` to synchronize configured values. The command uses
the authenticated `gh` CLI and never prints secret values.

## Commands

```bash
gq --version  # 0.1.0
gq context show
gq context show --json
gq credentials configure
gq github actions sync --dry-run
gq github actions sync --yes
gq test post-deploy

# Interactive command picker
gq

# Ploi convenience commands
gq ploi servers list
gq ploi server show
gq ploi sites list
gq ploi site show

# Discover and call any documented Ploi API operation
gq ploi api list
gq ploi api list --group databases
gq ploi api describe databases.create-database --json
gq ploi api sites.get-site
gq ploi api databases.get-database --path id=42
gq ploi api servers.list-servers --all
gq ploi api sites.update-site --data '{"web_directory":"/public"}' --dry-run
gq ploi api sites.update-site --data-file requests/update-site.json --yes

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
gq --config /path/to/project/gq.ops.json context show
```

Use `--json` with any command for machine-readable output. Generic Ploi API calls always print the complete provider response as JSON.

## Interactive UX

When attached to a terminal, gq uses [Clack](https://github.com/bombshell-dev/clack) for command selection, searchable Ploi operation discovery, progress indicators, mutation confirmation, cancellation, and errors. Non-GET API calls prompt for confirmation interactively; automation must pass `--yes`, so existing scripts never block waiting for input.

## Ploi API operations

Operation IDs follow the official documentation route, such as `servers.create-server`, `wordpress-management.install-plugin`, and `database.run-database-backup`. Use `gq ploi api list` to discover them and `gq ploi api describe <operation-id>` to inspect the HTTP method, path placeholders, and source documentation.

- `--server` and `--site` override project defaults for matching path placeholders.
- Supply other placeholders with repeatable `--path name=value` options.
- Supply query parameters with repeatable `--query name=value`, or use `--page` and `--per-page`.
- Supply a complete JSON body with `--data` or a project-relative `--data-file`.
- `--all` follows trusted Ploi pagination links, with an optional `--max-pages` limit.
- Every non-GET operation requires interactive confirmation or `--yes`. Use `--dry-run` to inspect the resolved method, URL, and body without making the request.

The researched endpoint inventory, including request fields and source links, is in [`docs/research/ploi-api.md`](docs/research/ploi-api.md).

## How project discovery works

1. Start at the current working directory.
2. Resolve it to its canonical path.
3. Walk upward until `gq.ops.json` is found, stopping at the nearest Git repository root.
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
