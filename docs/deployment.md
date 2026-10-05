# Deployment and sharing

## Try it with ChatGPT today

The temporary HTTPS tunnel is `https://d16e-118-70-84-239.ngrok-free.app`. Its MCP endpoint is `https://d16e-118-70-84-239.ngrok-free.app/mcp`. It serves `get_question`, `submit_answer`, and `search_theory`. The public web page is `https://d16e-118-70-84-239.ngrok-free.app/play`. This URL works only while the local stateless server and ngrok process stay running. It does not expose the private SQLite progress file or the local `/preview` routes.

To connect this server in ChatGPT, check the Developer mode control in Settings → Security and login. OpenAI's MCP app help also documents Settings → Apps → Advanced settings for eligible accounts. If your account shows neither control, developer connections may be unavailable under its current account or workspace policy; the public study page above remains usable, and you can test `/mcp` directly with MCP Inspector. If Developer mode is available, open [ChatGPT Plugins](https://chatgpt.com/plugins), select the plus button, and create an MCP connection named `Lý Thuyết Lái Xe` using the HTTPS `/mcp` URL above. Confirm that ChatGPT discovers exactly three tools. In a new chat, add that connection from the tools menu and ask: `Cho tôi luyện câu q301 về biển báo. Đừng tiết lộ đáp án trước khi tôi chọn.` Then choose A and ask it to check the answer. If the connection metadata is stale, open its Plugins entry and select Refresh before starting another new chat.

The temporary connection tests the MCP server and optional quiz card. The skill in `skills/driving-theory-tutor/SKILL.md` is packaged locally; it is not installed into ChatGPT just by adding the MCP connection. Test the combined plugin after registering a stable MCP server and installing the package from a supported plugin source.

## Host the public study page and MCP server

Build the app and put it on a Docker-capable host that provides a stable HTTPS domain. Set `PORT` to the listening port and `PUBLIC_BASE_URL` to the final origin, for example `https://study.example.com`. The server binds to `0.0.0.0` in this stateless public mode. The host should send HTTPS traffic to the container's port.

```bash
docker build -t ly-thuyet-lai-xe:latest .
docker run --rm -p 8787:8787 -e PORT=8787 -e PUBLIC_BASE_URL=https://study.example.com ly-thuyet-lai-xe:latest
```

After deployment, check `https://study.example.com/`, `/play`, `/mcp`, and `/images/q301.webp`. Run `node scripts/check-public-preview.mjs https://study.example.com`; it checks MCP discovery and confirms private progress routes return 404. Share `/play` for browser use. Use `/mcp` when registering a ChatGPT developer connection.

The source package has a portable `plugin.json`, `mcp.json`, and tutor skill. Before submitting to the public Plugins Directory, replace the local URL in `mcp.json` with the stable HTTPS `/mcp` URL and complete the required listing, support, privacy, terms, review cases, and domain verification in the publisher account. Review distribution rights for the bundled question images. Do not submit a package pointing at a temporary ngrok URL; the published MCP URL is difficult to change later. Submission and publication remain human decisions.

## Personal progress for multiple learners

The local `/preview` stores one private learner's attempts in `.data/study.sqlite`. Public mode intentionally omits progress and reviews. To offer those features to other people's ChatGPT accounts, add OAuth 2.1 user authentication, learner-scoped storage, and deletion controls before exposing progress tools on a public endpoint. ChatGPT's documented MCP authorization flow requires token verification on every protected request.

The TypeScript build and compiled production process were checked locally. A Docker image build was not verified in this workspace because the current user cannot access `/var/run/docker.sock`.
