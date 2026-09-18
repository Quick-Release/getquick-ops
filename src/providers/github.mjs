import { spawn } from "node:child_process";

export async function syncActionsValues({
  context,
  dryRun = false,
  yes = false,
  interactive = false,
}) {
  const github = context.config.github;
  const repository = github?.repository;
  const environment = github?.environment || "production";
  const secrets = normalizeEntries(github?.secrets);
  const variables = normalizeEntries(github?.variables);

  if (!repository)
    throw new Error("gq.ops.json must define github.repository.");
  if (!secrets || !variables) {
    throw new Error("github.secrets and github.variables must be arrays.");
  }

  const values = context.env;
  const activeSecrets = configuredEntries(secrets, values);
  const activeVariables = configuredEntries(variables, values);
  const missingSecrets = missingValues(secrets, values);
  const missingVariables = missingValues(variables, values);
  if (missingSecrets.length > 0 || missingVariables.length > 0) {
    const missing = [
      ...missingSecrets.map((name) => `secret ${name}`),
      ...missingVariables.map((name) => `variable ${name}`),
    ];
    throw new Error(
      `Missing values in .env or the process environment: ${missing.join(", ")}`,
    );
  }

  const plan = {
    repository,
    environment,
    secrets: activeSecrets.map(({ name }) => name),
    variables: activeVariables.map(({ name }) => name),
  };
  if (dryRun) return { ...plan, applied: false };

  if (!yes && interactive) {
    const { confirm } = await import("@clack/prompts");
    const answer = await confirm({
      message: `Sync ${secrets.length} secrets and ${variables.length} variables to ${repository}/${environment}?`,
      initialValue: false,
    });
    if (answer !== true) throw new Error("GitHub synchronization cancelled.");
  } else if (!yes && !interactive) {
    throw new Error(
      "GitHub synchronization requires --yes outside an interactive terminal.",
    );
  }

  for (const { name } of activeSecrets) {
    await runGh(
      ["secret", "set", name, "--repo", repository, "--env", environment],
      values[name],
      context.env,
    );
  }
  for (const { name } of activeVariables) {
    await runGh(
      ["variable", "set", name, "--repo", repository, "--env", environment],
      values[name],
      context.env,
    );
  }

  return { ...plan, applied: true };
}

async function runGh(args, input, environment) {
  const child = spawn("gh", args, {
    env: {
      ...process.env,
      ...(environment.GITHUB_TOKEN
        ? { GH_TOKEN: environment.GITHUB_TOKEN }
        : {}),
      ...(environment.GH_TOKEN ? { GH_TOKEN: environment.GH_TOKEN } : {}),
    },
    stdio: ["pipe", "pipe", "pipe"],
  });
  let stdout = "";
  let stderr = "";
  child.stdout.on("data", (chunk) => {
    stdout += chunk;
  });
  child.stderr.on("data", (chunk) => {
    stderr += chunk;
  });
  child.stdin.end(String(input));

  const exitCode = await new Promise((resolve, reject) => {
    child.once("error", reject);
    child.once("close", resolve);
  });
  if (exitCode !== 0) {
    throw new Error(
      `gh ${args.slice(0, 3).join(" ")} failed: ${(stderr || stdout).trim()}`,
    );
  }
}

function normalizeEntries(entries) {
  if (!Array.isArray(entries)) return null;
  return entries.map((entry) => {
    if (typeof entry === "string") return { name: entry, required: true };
    if (entry && typeof entry.name === "string") {
      return { name: entry.name, required: entry.required !== false };
    }
    throw new Error(
      "GitHub sync entries must be names or { name, required } objects.",
    );
  });
}

function configuredEntries(entries, values) {
  return entries.filter(
    ({ name }) => values[name] !== undefined && values[name] !== "",
  );
}

function missingValues(entries, values) {
  return entries
    .filter(
      ({ name, required }) =>
        required && (values[name] === undefined || values[name] === ""),
    )
    .map(({ name }) => name);
}
