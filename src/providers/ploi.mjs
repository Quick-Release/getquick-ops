import { requestJson } from "./http.mjs";

const API_BASE_URL = "https://ploi.io/api";

export function createPloiClient(options) {
  const token = required(options.token, "PLOI_API_TOKEN");
  const fetchImplementation = options.fetchImplementation;

  async function request(path) {
    return requestJson(toApiUrl(path), {
      fetchImplementation,
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
      },
      errorMessage(response, payload) {
        return (
          payload.message || `Ploi request failed with HTTP ${response.status}.`
        );
      },
    });
  }

  async function list(path) {
    const items = [];
    const visited = new Set();
    let next = toApiUrl(path);

    while (next) {
      if (visited.size >= 100)
        throw new Error("Ploi pagination exceeded 100 pages.");
      if (visited.has(next))
        throw new Error("Ploi pagination returned a repeated URL.");
      visited.add(next);

      const payload = await request(next);
      if (Array.isArray(payload.data)) items.push(...payload.data);
      next = payload.links?.next || payload.meta?.next_page_url || null;
      if (next) next = toApiUrl(next);
    }

    return items;
  }

  return {
    async listServers() {
      return list("/servers");
    },
    async getServer(serverId) {
      return unwrap(await request(`/servers/${encodeURIComponent(serverId)}`));
    },
    async listSites(serverId) {
      return list(`/servers/${encodeURIComponent(serverId)}/sites`);
    },
    async getSite(serverId, siteId) {
      return unwrap(
        await request(
          `/servers/${encodeURIComponent(serverId)}/sites/${encodeURIComponent(siteId)}`,
        ),
      );
    },
  };
}

function toApiUrl(path) {
  const url = /^https?:\/\//.test(path)
    ? new URL(path)
    : path.startsWith("/api/")
      ? new URL(path, new URL(API_BASE_URL).origin)
      : new URL(`${API_BASE_URL}/${path.replace(/^\/+/, "")}`);
  if (
    url.origin !== new URL(API_BASE_URL).origin ||
    !url.pathname.startsWith("/api/")
  ) {
    throw new Error("Ploi pagination returned an unexpected URL.");
  }
  return url.href;
}

function unwrap(payload) {
  return payload.data ?? payload;
}

function required(value, environmentName) {
  if (!value?.trim()) throw new Error(`${environmentName} is required.`);
  return value.trim();
}
