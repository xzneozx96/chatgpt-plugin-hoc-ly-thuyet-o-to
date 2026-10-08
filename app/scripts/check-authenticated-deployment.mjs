import assert from "node:assert/strict";

const base = new URL(process.argv[2] ?? "https://chatgpt-plugin-hoc-ly-thuyet-o-to.vercel.app");
const resource = new URL("/mcp", base).toString();
const metadataUrl = new URL("/.well-known/oauth-protected-resource/mcp", base);

const metadataResponse = await fetch(metadataUrl);
assert.equal(metadataResponse.status, 200, "OAuth protected-resource metadata must be public");
const metadata = await metadataResponse.json();
assert.equal(metadata.resource, resource);
assert.equal(metadata.authorization_servers?.length, 1);
assert.ok(metadata.authorization_servers[0].startsWith("https://"));

const initialize = {
  jsonrpc: "2.0",
  id: 1,
  method: "initialize",
  params: { protocolVersion: "2025-11-25", capabilities: {}, clientInfo: { name: "auth-check", version: "1.0" } }
};
const unauthenticated = await fetch(resource, {
  method: "POST",
  headers: { "content-type": "application/json", accept: "application/json, text/event-stream" },
  body: JSON.stringify(initialize)
});
assert.equal(unauthenticated.status, 401, "MCP must reject requests without a learner token");
assert.match(unauthenticated.headers.get("www-authenticate") ?? "", /resource_metadata="[^"]+\/\.well-known\/oauth-protected-resource\/mcp"/);

console.log(`OAuth discovery and unauthenticated MCP challenge passed for ${resource}`);
