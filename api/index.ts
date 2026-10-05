import { createHttpHandler } from "../src/server.js";

const app = createHttpHandler({ publicMode: true });

export default function handler(request: Parameters<typeof app.handler>[0], response: Parameters<typeof app.handler>[1]) {
  const url = new URL(request.url ?? "/", "https://localhost");
  const route = url.searchParams.get("route");
  if (route !== null) request.url = `/${route}`;
  return app.handler(request, response);
}
