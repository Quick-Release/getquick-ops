import assert from "node:assert/strict";
import test from "node:test";
import { runCli } from "../src/cli.mjs";
import { parseEnv } from "../src/env.mjs";
import { printValue } from "../src/output.mjs";
import { requestJson } from "../src/providers/http.mjs";

test("parses common dotenv quoting, comments, and escapes", () => {
  assert.deepEqual(
    parseEnv(`
PLAIN=value # comment
SINGLE='literal # value' # comment
DOUBLE="line\\nvalue" # comment
EMPTY=
export EXPORTED=yes
`),
    {
      PLAIN: "value",
      SINGLE: "literal # value",
      DOUBLE: "line\nvalue",
      EMPTY: "",
      EXPORTED: "yes",
    },
  );
});

test("non-JSON HTTP errors preserve provider status context", async () => {
  await assert.rejects(
    requestJson("https://example.test", {
      fetchImplementation: async () =>
        new Response("bad gateway", { status: 502 }),
    }),
    /HTTP 502/,
  );
});

test("human output escapes terminal control characters", () => {
  const lines = [];
  const original = console.log;
  console.log = (line) => lines.push(line);
  try {
    printValue([{ name: "safe\u001b]8;;https://example.test\u0007unsafe" }]);
  } finally {
    console.log = original;
  }

  assert.equal(
    lines.some((line) => line.includes("\u001b") || line.includes("\u0007")),
    false,
  );
  assert.equal(
    lines.some((line) => line.includes("\\u001b") && line.includes("\\u0007")),
    true,
  );
});

test("reports the package SemVer without requiring a project", async () => {
  for (const flag of ["--version", "-v"]) {
    assert.deepEqual(await captureConsole(() => runCli([flag])), ["0.1.0"]);
  }
});

test("validates command syntax before requiring provider credentials", async () => {
  await assert.rejects(
    runCli(["ploi", "unknown"]),
    /Unknown command: ploi unknown/,
  );
  await assert.rejects(
    runCli(["cloudflare", "accounts", "list", "extra"]),
    /Unknown command: cloudflare accounts list extra/,
  );
  await assert.rejects(
    runCli(["context", "show", "--site", "123"]),
    /--site is not valid for context show/,
  );
});

async function captureConsole(callback) {
  const lines = [];
  const original = console.log;
  console.log = (line) => lines.push(String(line));
  try {
    await callback();
  } finally {
    console.log = original;
  }
  return lines;
}
