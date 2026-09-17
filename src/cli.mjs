import { loadProjectContext } from "./project-context.mjs";
import { createCloudflareClient } from "./providers/cloudflare.mjs";
import { createPloiClient } from "./providers/ploi.mjs";
import { printValue } from "./output.mjs";

const COMMAND_OPTIONS = new Map([
  ["context show", []],
  ["ploi servers list", []],
  ["ploi server show", ["server"]],
  ["ploi sites list", ["server"]],
  ["ploi site show", ["server", "site"]],
  ["cloudflare accounts list", []],
  ["cloudflare zones list", ["account"]],
  ["cloudflare zone show", ["account", "zone"]],
  ["cloudflare dns list", ["account", "zone", "name", "type"]],
]);

export async function runCli(argv, options = {}) {
  const parsed = parseArguments(argv);
  if (parsed.help || parsed.command.length === 0) {
    printHelp();
    return;
  }
  validateCommand(parsed);

  const context = await loadProjectContext({
    cwd: options.cwd,
    environment: options.environment,
    project: parsed.project,
    config: parsed.config,
  });
  const [provider, resource, action = "list"] = parsed.command;

  if (provider === "context" && resource === "show") {
    printValue(contextSummary(context), parsed);
    return;
  }

  if (provider === "ploi") {
    await runPloi({
      context,
      resource,
      action,
      parsed,
      fetchImplementation: options.fetchImplementation,
    });
    return;
  }

  if (provider === "cloudflare") {
    await runCloudflare({
      context,
      resource,
      action,
      parsed,
      fetchImplementation: options.fetchImplementation,
    });
    return;
  }

  throw new Error(
    `Unknown command: ${parsed.command.join(" ")}. Run gq --help.`,
  );
}

async function runPloi({
  context,
  resource,
  action,
  parsed,
  fetchImplementation,
}) {
  const client = createPloiClient({
    token: context.env.PLOI_API_TOKEN,
    fetchImplementation,
  });
  const serverId =
    parsed.server ||
    context.env.PLOI_SERVER_ID ||
    context.config.ploi?.serverId;
  const siteId =
    parsed.site || context.env.PLOI_SITE_ID || context.config.ploi?.siteId;
  let result;

  if (resource === "servers" && action === "list") {
    result = (await client.listServers()).map(presentPloiServer);
  } else if (resource === "server" && action === "show") {
    result = presentPloiServer(
      await client.getServer(required(serverId, "Ploi server ID")),
    );
  } else if (resource === "sites" && action === "list") {
    result = (await client.listSites(required(serverId, "Ploi server ID"))).map(
      presentPloiSite,
    );
  } else if (resource === "site" && action === "show") {
    result = presentPloiSite(
      await client.getSite(
        required(serverId, "Ploi server ID"),
        required(siteId, "Ploi site ID"),
      ),
    );
  } else {
    throw new Error(
      `Unknown Ploi command: ${resource || ""} ${action}. Run gq --help.`,
    );
  }

  printValue(result, parsed);
}

async function runCloudflare({
  context,
  resource,
  action,
  parsed,
  fetchImplementation,
}) {
  const client = createCloudflareClient({
    token: context.env.CLOUDFLARE_API_TOKEN,
    fetchImplementation,
  });
  const accountId =
    parsed.account ||
    context.env.CLOUDFLARE_ACCOUNT_ID ||
    context.config.cloudflare?.accountId;
  let zoneId =
    parsed.zone ||
    context.env.CLOUDFLARE_ZONE_ID ||
    context.config.cloudflare?.zoneId;
  const zoneName =
    context.env.CLOUDFLARE_ZONE_NAME || context.config.cloudflare?.zoneName;
  let result;

  if (resource === "accounts" && action === "list") {
    result = (await client.listAccounts()).map(presentCloudflareAccount);
  } else if (resource === "zones" && action === "list") {
    result = (
      await client.listZones({ "account.id": accountId, name: zoneName })
    ).map(presentCloudflareZone);
  } else if (resource === "zone" && action === "show") {
    zoneId = await resolveZoneId(client, { zoneId, zoneName, accountId });
    result = presentCloudflareZone(await client.getZone(zoneId));
  } else if (resource === "dns" && action === "list") {
    zoneId = await resolveZoneId(client, { zoneId, zoneName, accountId });
    result = (
      await client.listDnsRecords(zoneId, {
        name: parsed.name,
        type: parsed.type,
      })
    ).map(presentDnsRecord);
  } else {
    throw new Error(
      `Unknown Cloudflare command: ${resource || ""} ${action}. Run gq --help.`,
    );
  }

  printValue(result, parsed);
}

async function resolveZoneId(client, { zoneId, zoneName, accountId }) {
  if (zoneId) return zoneId;
  const zones = await client.listZones({
    name: zoneName,
    "account.id": accountId,
  });
  if (zones.length !== 1) {
    throw new Error(
      `Expected exactly one matching Cloudflare zone, found ${zones.length}. Configure cloudflare.zoneId or pass --zone.`,
    );
  }
  return zones[0].id;
}

function parseArguments(argv) {
  const parsed = { command: [] };
  const valueOptions = new Set([
    "--project",
    "--config",
    "--server",
    "--site",
    "--account",
    "--zone",
    "--name",
    "--type",
  ]);

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--help" || argument === "-h" || argument === "help")
      parsed.help = true;
    else if (argument === "--json") parsed.json = true;
    else if (valueOptions.has(argument)) {
      const value = argv[index + 1];
      if (!value || value.startsWith("--"))
        throw new Error(`${argument} requires a value.`);
      parsed[toOptionKey(argument)] = value;
      index += 1;
    } else if (argument.startsWith("--"))
      throw new Error(`Unknown option: ${argument}.`);
    else parsed.command.push(argument);
  }

  return parsed;
}

function toOptionKey(argument) {
  return argument
    .slice(2)
    .replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
}

function validateCommand(parsed) {
  const command = parsed.command.join(" ");
  const allowedOptions = COMMAND_OPTIONS.get(command);
  if (!allowedOptions)
    throw new Error(`Unknown command: ${command}. Run gq --help.`);

  const globals = new Set(["command", "help", "json", "project", "config"]);
  for (const key of Object.keys(parsed)) {
    if (!globals.has(key) && !allowedOptions.includes(key)) {
      throw new Error(`--${toFlagName(key)} is not valid for ${command}.`);
    }
  }
}

function toFlagName(key) {
  return key.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);
}

function contextSummary(context) {
  return {
    project: context.config.project,
    projectRoot: context.projectRoot,
    configPath: context.configPath,
    invocationDirectory: context.invocationDirectory,
    machineEnvPath: context.machineEnvPath,
    ploiConfigured: Boolean(context.env.PLOI_API_TOKEN),
    cloudflareConfigured: Boolean(context.env.CLOUDFLARE_API_TOKEN),
  };
}

function presentPloiServer(server) {
  return {
    id: server.id,
    name: server.name,
    status: server.status,
    ip: server.ip_address,
    provider: server.provider,
    region: server.region,
  };
}

function presentPloiSite(site) {
  return {
    id: site.id,
    domain: site.domain,
    status: site.status,
    systemUser: site.system_user,
    projectRoot: site.project_root,
    webDirectory: site.web_directory,
    lastDeployAt: site.last_deploy_at,
  };
}

function presentCloudflareAccount(account) {
  return { id: account.id, name: account.name, type: account.type };
}

function presentCloudflareZone(zone) {
  return {
    id: zone.id,
    name: zone.name,
    status: zone.status,
    account: zone.account?.name,
    accountId: zone.account?.id,
    plan: zone.plan?.name,
  };
}

function presentDnsRecord(record) {
  return {
    id: record.id,
    type: record.type,
    name: record.name,
    content: record.content,
    proxied: record.proxied,
    ttl: record.ttl,
  };
}

function required(value, label) {
  if (value === undefined || value === null || String(value).trim() === "") {
    throw new Error(
      `${label} is required in getquick.ops.json, .env, or a CLI flag.`,
    );
  }
  return String(value).trim();
}

function printHelp() {
  console.log(`GetQuick operations CLI (read-only)

Usage:
  gq [global options] <command> [command options]

Project:
  gq context show

Ploi:
  gq ploi servers list
  gq ploi server show [--server <id>]
  gq ploi sites list [--server <id>]
  gq ploi site show [--server <id>] [--site <id>]

Cloudflare:
  gq cloudflare accounts list
  gq cloudflare zones list [--account <id>]
  gq cloudflare zone show [--zone <id>]
  gq cloudflare dns list [--zone <id>] [--name <hostname>] [--type <type>]

Global options:
  --project <directory>  Select a project explicitly
  --config <file>        Select a configuration file explicitly
  --json                 Print machine-readable JSON
  --help, -h             Show this help

The CLI searches upward from the current directory for getquick.ops.json.`);
}
