import assert from "node:assert/strict";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

const origin = process.argv[2] ?? "http://127.0.0.1:8788";
const client = new Client({ name: "public-preview-check", version: "1.0" });
const transport = new StreamableHTTPClientTransport(new URL("/mcp", origin));
try {
  await client.connect(transport);
  const names = (await client.listTools()).tools.map((tool) => tool.name).sort();
  assert.deepEqual(names, ["get_question", "search_theory", "submit_answer"]);
  assert.equal((await fetch(new URL("/preview", origin))).status, 404);
  assert.equal((await fetch(new URL("/preview/tool", origin), { method: "POST" })).status, 404);
  assert.equal((await fetch(new URL("/play", origin))).status, 200);
  const answer = await client.callTool({ name: "get_question", arguments: { questionId: "q301" } });
  assert.equal((answer.structuredContent ?? {}).id, "q301");
  console.log(JSON.stringify({ origin, tools: names, publicPlay: "200", privateRoutes: "404", imageUrl: (answer.structuredContent ?? {}).imageUrl }));
} finally {
  await client.close();
  await transport.close();
}
