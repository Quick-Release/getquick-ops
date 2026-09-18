import {
  confirm,
  intro,
  isCancel,
  log,
  password,
  text,
  outro,
} from "@clack/prompts";
import { mergeEnvFile, readEnvFile } from "./env.mjs";

export async function configureCredentials(context, options = {}) {
  const specification = context.config.credentials;
  const fields = specification?.fields;
  if (!Array.isArray(fields) || fields.length === 0) {
    throw new Error(
      "gq.ops.json must define credentials.fields before configuring credentials.",
    );
  }
  if (!options.interactive) {
    throw new Error(
      "Credential configuration requires an interactive terminal.",
    );
  }

  const envPath = context.resolvePath(specification.envFile || ".env");
  const existing = await readEnvFile(envPath);
  const updates = {};
  const configured = [];
  const preserved = [];

  intro(`Configure ${context.config.project} credentials`);
  for (const field of fields) {
    validateField(field);
    const current = existing[field.name];
    if (current && !options.replaceExisting) {
      const keep = await confirm({
        message: `${field.label || field.name} is already saved. Keep it?`,
        initialValue: true,
      });
      if (isCancel(keep)) return;
      if (keep) {
        preserved.push(field.name);
        continue;
      }
    }

    const prompt = field.secret ? password : text;
    const answer = await prompt({
      message: field.label || field.name,
      initialValue: field.secret ? undefined : current || field.default || "",
      validate(value) {
        if (field.required !== false && !String(value || "").trim()) {
          return `${field.name} is required.`;
        }
        return undefined;
      },
    });
    if (isCancel(answer)) return;
    if (answer === "" && field.required === false) continue;
    updates[field.name] = String(answer).trim();
    configured.push(field.name);
  }

  await mergeEnvFile(envPath, updates);
  log.success(`Saved credentials to ${envPath} with mode 0600.`);
  if (configured.length > 0) log.info(`Configured: ${configured.join(", ")}`);
  if (preserved.length > 0) log.info(`Preserved: ${preserved.join(", ")}`);
  outro("Credential configuration complete.");
}

function validateField(field) {
  if (
    !field ||
    typeof field !== "object" ||
    typeof field.name !== "string" ||
    !field.name.trim()
  ) {
    throw new Error("Each credentials.fields entry must define a name.");
  }
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(field.name)) {
    throw new Error(`Invalid credential name: ${field.name}`);
  }
}
