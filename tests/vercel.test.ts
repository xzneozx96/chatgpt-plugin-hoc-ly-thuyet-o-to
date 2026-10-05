import assert from "node:assert/strict";
import { once } from "node:events";
import { createServer } from "node:http";
import { test } from "node:test";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

test("Vercel entry point serves the public quiz, bank image, and stateless MCP", async () => {
  process.env.VERCEL = "1";
  const { default: handler } = await import("../api/index.js");
  const server = createServer(handler);
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Missing test port");
  const origin = `http://127.0.0.1:${address.port}`;
  const request = (route: string, init: RequestInit = {}) => {
    const { headers, ...rest } = init;
    return fetch(`${origin}/api/index?route=${encodeURIComponent(route)}`, {
      ...rest,
      headers
    });
  };
  const transport = new StreamableHTTPClientTransport(new URL(`${origin}/api/index?route=mcp`));
  const client = new Client({ name: "vercel-adapter-test", version: "1.0" });
  try {
    await client.connect(transport);
    assert.deepEqual((await client.listTools()).tools.map((tool) => tool.name).sort(), ["get_question", "search_theory", "submit_answer"]);
    assert.equal((await request("play")).status, 200);
    assert.equal((await request("ui/quiz.html")).status, 200);
    assert.equal((await request("images/q301.webp")).headers.get("content-type"), "image/webp");
    assert.equal((await request("preview")).status, 404);
    const response = await request("play/tool", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "get_question", arguments: { questionId: "q301" } })
    });
    assert.equal((await response.json()).structuredContent.imageUrl, `https://127.0.0.1:${address.port}/images/q301.webp`);
  } finally {
    await client.close();
    await transport.close();
    await new Promise<void>((resolve) => server.close(() => resolve()));
    delete process.env.VERCEL;
  }
});
