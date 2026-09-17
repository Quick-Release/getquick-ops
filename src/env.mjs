import { readFile } from "node:fs/promises";

export function parseEnv(content) {
  const values = {};

  for (const line of content.split(/\r?\n/)) {
    const match = line.match(
      /^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/,
    );
    if (!match) continue;
    values[match[1]] = parseValue(match[2]);
  }

  return values;
}

export async function readEnvFile(path) {
  try {
    return parseEnv(await readFile(path, "utf8"));
  } catch (error) {
    if (error?.code === "ENOENT") return {};
    throw error;
  }
}

function parseValue(value) {
  const trimmed = value.trim();
  if (trimmed.startsWith("'")) {
    const closing = trimmed.indexOf("'", 1);
    if (closing !== -1) return trimmed.slice(1, closing);
  }
  if (trimmed.startsWith('"')) {
    const match = trimmed.match(/^"((?:\\.|[^"\\])*)"/);
    if (match) {
      return match[1].replace(/\\([nrt"\\])/g, (_, escaped) => {
        return { n: "\n", r: "\r", t: "\t", '"': '"', "\\": "\\" }[escaped];
      });
    }
  }
  return trimmed.replace(/\s+#.*$/, "").trim();
}
