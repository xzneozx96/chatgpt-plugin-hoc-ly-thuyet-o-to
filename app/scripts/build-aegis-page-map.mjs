import { writeFileSync } from "node:fs";

const url = process.env.AEGIS_MCP_URL ?? "https://aegis-api.minastik.com/mcp-apps/";
const token = process.env.AEGIS_MCP_TOKEN;
const docId = process.env.AEGIS_DOC_ID ?? "c425d48cafe4";
if (!token) throw new Error("Set AEGIS_MCP_TOKEN");

async function call(name, args) {
  const res = await fetch(url, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", Accept: "application/json, text/event-stream" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/call", params: { name, arguments: args } })
  });
  const body = await res.json();
  const text = body.result.content[0].text;
  return JSON.parse(text.slice(text.indexOf("{"), text.lastIndexOf("</untrusted_data>")));
}

const outline = await call("get_document_structure", { doc_id: docId });
const starts = new Map();
const walk = (nodes) => nodes.forEach((node) => {
  const match = /^Câu (\d+)\b/.exec(node.title);
  if (match && node.page >= 36 && !starts.has(Number(match[1]))) starts.set(Number(match[1]), node.page);
  walk(node.nodes ?? []);
});
walk(outline.structure);
const missing = Array.from({ length: 600 }, (_, i) => i + 1).filter((n) => !starts.has(n));
if (missing.length) throw new Error(`No page for questions: ${missing.join(",")}`);

const front = await call("get_page_content", { doc_id: docId, pages: "2" });
const html = front.content[0].text;
const videos = {};
for (const row of html.matchAll(/<tr><td>(V\d+)<\/td><td>(.*?)<\/td><td>.*?<\/td><td>https:\/\/www\.youtube\.com\/watch\?v=([\w-]+)<\/td><\/tr>/g)) {
  videos[row[1]] = { title: row[2], youtubeId: row[3] };
}
if (Object.keys(videos).length !== 11) throw new Error(`Expected 11 videos, got ${Object.keys(videos).length}`);

const pages = Object.fromEntries([...starts].sort((a, b) => a[0] - b[0]));
writeFileSync(new URL("../src/content/aegis-book-map.json", import.meta.url), `${JSON.stringify({ docId, questionPages: pages, videos }, null, 1)}\n`);
console.log(`questions: ${starts.size}, videos: ${Object.keys(videos).length}`);
