import assert from "node:assert/strict";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { runCli } from "../src/cli.mjs";
import {
  PLOI_ENDPOINTS,
  ploiCatalog,
} from "../src/providers/ploi-endpoints.mjs";
import { createPloiClient } from "../src/providers/ploi.mjs";
import { isInteractive } from "../src/ui.mjs";

test("Ploi catalog covers every researched API operation", () => {
  assert.equal(PLOI_ENDPOINTS.length, 225);
  assert.equal(new Set(PLOI_ENDPOINTS.map(({ id }) => id)).size, 225);
  assert.deepEqual(ploiCatalog.get("sites.get-site"), {
    id: "sites.get-site",
    method: "GET",
    path: "/api/servers/{server}/sites/{site}",
    sourceUrl: "https://developers.ploi.io/sites/get-site",
    summary: "Get a single site from a server.",
  });
  assert.deepEqual(
    ploiCatalog.get("getting-started.teapot").acceptedStatuses,
    [418],
  );
});

test("Ploi endpoint executor encodes path and query values and sends JSON", async () => {
  let recorded;
  const client = createPloiClient({
    token: "secret",
    fetchImplementation: async (url, options) => {
      recorded = { url: String(url), options };
      return jsonResponse({ data: { id: 9 } });
    },
  });

  assert.deepEqual(
    await client.executeEndpoint(
      { method: "PATCH", path: "/api/servers/{server}/sites/{site}" },
      {
        pathParameters: { server: "server/one", site: "site two" },
        query: { include: ["repository", "status"] },
        body: { web_directory: "/dist" },
      },
    ),
    { data: { id: 9 } },
  );

  const url = new URL(recorded.url);
  assert.equal(url.pathname, "/api/servers/server%2Fone/sites/site%20two");
  assert.deepEqual(url.searchParams.getAll("include"), [
    "repository",
    "status",
  ]);
  assert.equal(recorded.options.method, "PATCH");
  assert.equal(recorded.options.headers.Authorization, "Bearer secret");
  assert.equal(recorded.options.headers["Content-Type"], "application/json");
  assert.equal(recorded.options.body, '{"web_directory":"/dist"}');
});

test("Ploi teapot operation accepts its documented 418 response", async () => {
  const client = createPloiClient({
    token: "secret",
    fetchImplementation: async () =>
      jsonResponse({ message: "I'm a teapot" }, 418),
  });

  assert.deepEqual(
    await client.executeEndpoint(ploiCatalog.get("getting-started.teapot")),
    { message: "I'm a teapot" },
  );
});

test("Ploi catalog commands do not require a project or token", async () => {
  const output = await captureConsole(() =>
    runCli(["ploi", "api", "describe", "servers.list-servers", "--json"]),
  );
  const description = JSON.parse(output.join("\n"));

  assert.equal(description.method, "GET");
  assert.equal(description.path, "/api/servers");
  assert.equal(description.mutationRequiresConfirmation, false);
});

test("Ploi API commands use project IDs and reject unconfirmed automation", async () => {
  const root = await createProject();
  let requests = 0;
  const fetchImplementation = async (url, options) => {
    requests += 1;
    assert.equal(String(url), "https://ploi.io/api/servers/12/sites/34");
    assert.equal(options.method, "PATCH");
    assert.equal(options.body, '{"web_directory":"/dist"}');
    return jsonResponse({ data: { id: 34 } });
  };
  const common = {
    cwd: root,
    environment: { PLOI_API_TOKEN: "secret" },
    fetchImplementation,
    interactive: false,
  };

  await assert.rejects(
    runCli(
      [
        "ploi",
        "api",
        "sites.update-site",
        "--data",
        '{"web_directory":"/dist"}',
      ],
      common,
    ),
    /changes remote state.*--yes/,
  );
  assert.equal(requests, 0);

  await captureConsole(() =>
    runCli(
      [
        "ploi",
        "api",
        "sites.update-site",
        "--data",
        '{"web_directory":"/dist"}',
        "--yes",
      ],
      common,
    ),
  );
  assert.equal(requests, 1);
});

test("interactive mode can be explicitly controlled by the host", () => {
  assert.equal(isInteractive({ interactive: true }), true);
  assert.equal(isInteractive({ interactive: false }), false);
});

async function createProject() {
  const root = await mkdtemp(join(tmpdir(), "gq-ops-"));
  await writeFile(
    join(root, "gq.ops.json"),
    JSON.stringify({
      project: "ploi-api-test",
      ploi: { serverId: "12", siteId: "34" },
    }),
  );
  return root;
}

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

function jsonResponse(payload, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "content-type": "application/json" },
  });
}
