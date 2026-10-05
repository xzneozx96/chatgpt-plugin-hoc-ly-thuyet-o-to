import assert from "node:assert/strict";
import { once } from "node:events";
import { createServer } from "node:http";
import { test } from "node:test";
import { createLocalJWKSet, exportJWK, generateKeyPair, SignJWT } from "jose";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { createHttpHandler } from "../src/server.js";
import type { Attempt } from "../src/domain/study.js";
import type { UserAttemptStore } from "../src/domain/workspace.js";
import type { AuthKitConfig, TokenVerifier } from "../src/auth/authkit.js";
import { authenticateBearer, createAuthKitVerifier, readAuthKitConfig } from "../src/auth/authkit.js";

class MemoryRemoteStore implements UserAttemptStore {
  private readonly attempts = new Map<string, Attempt>();

  async append(userId: string, attempt: Attempt) {
    const key = `${userId}:${attempt.attemptId}`;
    const existing = this.attempts.get(key);
    if (existing) {
      if (existing.questionId !== attempt.questionId || existing.selectedAnswer !== attempt.selectedAnswer) throw new Error("ATTEMPT_ID_CONFLICT");
      return { attempt: existing, duplicate: true };
    }
    this.attempts.set(key, attempt);
    return { attempt, duplicate: false };
  }

  async all(userId: string) {
    return [...this.attempts.entries()].filter(([key]) => key.startsWith(`${userId}:`)).map(([, attempt]) => attempt);
  }

  async deleteAll(userId: string) {
    const keys = [...this.attempts.keys()].filter((key) => key.startsWith(`${userId}:`));
    for (const key of keys) this.attempts.delete(key);
    return keys.length;
  }
}

const config: AuthKitConfig = { issuer: "https://identity.example", publicBaseUrl: "https://tutor.example", databaseUrl: "postgres://unused" };
const verifier: TokenVerifier = {
  async verify(token) {
    if (token === "alice") return { issuer: config.issuer, subject: "learner-a", scopes: ["openid"] };
    if (token === "bob") return { issuer: config.issuer, subject: "learner-b", scopes: ["openid"] };
    if (token === "no-scope") return { issuer: config.issuer, subject: "learner-a", scopes: [] };
    throw new Error("INVALID_TOKEN");
  }
};

test("AuthKit token checks reject wrong issuer, audience, expiry, and missing scope", async () => {
  const { publicKey, privateKey } = await generateKeyPair("RS256");
  const jwk = { ...await exportJWK(publicKey), kid: "test-key", alg: "RS256", use: "sig" };
  const verify = createAuthKitVerifier(config, createLocalJWKSet({ keys: [jwk] }));
  const token = (claims: { issuer?: string; audience?: string; scope?: string; expiresIn?: string } = {}) =>
    new SignJWT({ scope: claims.scope ?? "openid" })
      .setProtectedHeader({ alg: "RS256", kid: "test-key" })
      .setIssuer(claims.issuer ?? config.issuer)
      .setAudience(claims.audience ?? `${config.publicBaseUrl}/mcp`)
      .setSubject("learner-a")
      .setIssuedAt()
      .setExpirationTime(claims.expiresIn ?? "1h")
      .sign(privateKey);
  assert.equal((await authenticateBearer(`Bearer ${await token()}`, verify)).length, 64);
  await assert.rejects(authenticateBearer(`Bearer ${await token({ issuer: "https://other.example" })}`, verify));
  await assert.rejects(authenticateBearer(`Bearer ${await token({ audience: "https://other.example/mcp" })}`, verify));
  await assert.rejects(authenticateBearer(`Bearer ${await token({ expiresIn: "-1h" })}`, verify));
  await assert.rejects(authenticateBearer(`Bearer ${await token({ scope: "profile" })}`, verify), /TOKEN_SCOPE_MISSING/);
});

test("an existing public base URL does not activate login without AuthKit and database settings", () => {
  assert.equal(readAuthKitConfig({ PUBLIC_BASE_URL: "https://tutor.example" }), null);
  assert.throws(() => readAuthKitConfig({ PUBLIC_BASE_URL: "https://tutor.example", DATABASE_URL: "postgres://db" }), /AUTH_CONFIGURATION_INCOMPLETE/);
});

async function serve(store: UserAttemptStore) {
  const app = createHttpHandler({ publicMode: true, authConfig: config, verifier, remoteStore: store });
  const server = createServer(app.handler);
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Missing test port");
  return { server, origin: `http://127.0.0.1:${address.port}` };
}

function clientAt(origin: string, token: string) {
  const transport = new StreamableHTTPClientTransport(new URL(`${origin}/mcp`), { requestInit: { headers: { authorization: `Bearer ${token}` } } });
  return { transport, client: new Client({ name: `auth-test-${token}`, version: "1.0" }) };
}

test("authenticated MCP isolates learners, persists across handler restart, and deletes only confirmed own history", async () => {
  const store = new MemoryRemoteStore();
  const firstServer = await serve(store);
  const alice = clientAt(firstServer.origin, "alice");
  const bob = clientAt(firstServer.origin, "bob");
  try {
    await alice.client.connect(alice.transport);
    await bob.client.connect(bob.transport);
    assert.deepEqual((await alice.client.listTools()).tools.map((tool) => tool.name).sort(), ["delete_my_progress", "get_due_reviews", "get_progress", "get_question", "search_theory", "submit_answer"]);
    const tools = (await alice.client.listTools()).tools;
    assert.equal(tools.find((tool) => tool.name === "delete_my_progress")?.annotations?.destructiveHint, true);
    const attempt = { questionId: "q001", selectedAnswer: "A", attemptId: "00000000-0000-4000-8000-000000000001" };
    await alice.client.callTool({ name: "submit_answer", arguments: attempt });
    const duplicate = await alice.client.callTool({ name: "submit_answer", arguments: attempt });
    assert.equal((duplicate.structuredContent as { duplicate: boolean }).duplicate, true);
    const conflict = await alice.client.callTool({ name: "submit_answer", arguments: { ...attempt, selectedAnswer: "B" } });
    assert.equal(conflict.isError, true);
    await bob.client.callTool({ name: "submit_answer", arguments: { questionId: "q001", selectedAnswer: "B", attemptId: "00000000-0000-4000-8000-000000000001" } });
    assert.equal(((await alice.client.callTool({ name: "get_progress", arguments: {} })).structuredContent as { totalAttempts: number }).totalAttempts, 1);
    assert.equal(((await bob.client.callTool({ name: "get_progress", arguments: {} })).structuredContent as { correctAttempts: number }).correctAttempts, 1);
  } finally {
    await alice.client.close(); await alice.transport.close();
    await bob.client.close(); await bob.transport.close();
    await new Promise<void>((resolve) => firstServer.server.close(() => resolve()));
  }

  const restarted = await serve(store);
  const aliceAfterRestart = clientAt(restarted.origin, "alice");
  const bobAfterRestart = clientAt(restarted.origin, "bob");
  try {
    await aliceAfterRestart.client.connect(aliceAfterRestart.transport);
    await bobAfterRestart.client.connect(bobAfterRestart.transport);
    assert.equal(((await aliceAfterRestart.client.callTool({ name: "get_progress", arguments: {} })).structuredContent as { totalAttempts: number }).totalAttempts, 1);
    const deleted = await aliceAfterRestart.client.callTool({ name: "delete_my_progress", arguments: { confirm: true } });
    assert.equal((deleted.structuredContent as { deletedAttempts: number }).deletedAttempts, 1);
    assert.equal(((await aliceAfterRestart.client.callTool({ name: "get_progress", arguments: {} })).structuredContent as { totalAttempts: number }).totalAttempts, 0);
    assert.equal(((await bobAfterRestart.client.callTool({ name: "get_progress", arguments: {} })).structuredContent as { totalAttempts: number }).totalAttempts, 1);
  } finally {
    await aliceAfterRestart.client.close(); await aliceAfterRestart.transport.close();
    await bobAfterRestart.client.close(); await bobAfterRestart.transport.close();
    await new Promise<void>((resolve) => restarted.server.close(() => resolve()));
  }
});

test("protected MCP rejects missing and invalid bearer tokens while advertising OAuth metadata", async () => {
  const { server, origin } = await serve(new MemoryRemoteStore());
  try {
    const metadata = await fetch(`${origin}/.well-known/oauth-protected-resource/mcp`);
    assert.equal(metadata.status, 200);
    assert.deepEqual(await metadata.json(), { resource: "https://tutor.example/mcp", authorization_servers: ["https://identity.example"], bearer_methods_supported: ["header"], scopes_supported: ["openid"] });
    const missing = await fetch(`${origin}/mcp`, { method: "POST", headers: { "content-type": "application/json" }, body: "{}" });
    assert.equal(missing.status, 401);
    assert.match(missing.headers.get("www-authenticate") ?? "", /resource_metadata=/);
    const invalid = await fetch(`${origin}/mcp`, { method: "POST", headers: { authorization: "Bearer bad", "content-type": "application/json" }, body: "{}" });
    assert.equal(invalid.status, 401);
    const missingScope = await fetch(`${origin}/mcp`, { method: "POST", headers: { authorization: "Bearer no-scope", "content-type": "application/json" }, body: "{}" });
    assert.equal(missingScope.status, 401);
  } finally { await new Promise<void>((resolve) => server.close(() => resolve())); }
});
