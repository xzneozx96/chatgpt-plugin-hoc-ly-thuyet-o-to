# Enable saved reviews in ChatGPT

This guide connects a WorkOS AuthKit login and a Neon Postgres database to the public MCP server. ChatGPT then sends a verified access token with each tool call. The server stores each answer under that learner's account and calculates due reviews from those answers.

## Create the database

1. Create a Neon Postgres database. The [Neon and Vercel integration](https://neon.com/docs/guides/vercel) can attach one to the Vercel project.
2. Run [the schema](../scripts/neon-schema.sql) once in Neon's SQL editor.
3. Set `DATABASE_URL` in the Vercel project's environment variables. Use the connection string for that database. Do not put it in Git or the browser.

The `attempts` table stores an opaque account key, the question and selected answer, whether it was correct, and the answer time. The primary key makes a repeated `attemptId` count once for that account.

## Configure learner login

1. Create a WorkOS AuthKit environment and enable a login method for learners.
2. In **Connect → Configuration**, enable **Client ID Metadata Document**. WorkOS can then identify ChatGPT as an OAuth client without a client secret in this repository.
3. Add `https://chatgpt-plugin-hoc-ly-thuyet-o-to.vercel.app/mcp` as a **Resource Indicator**. Set it as the default if WorkOS offers that option for your environment.
4. Copy the issuer URL from `https://YOUR_AUTHKIT_DOMAIN/.well-known/oauth-authorization-server`. Set the exact `issuer` value as `AUTHKIT_ISSUER` in Vercel.
5. Set `PUBLIC_BASE_URL` to `https://chatgpt-plugin-hoc-ly-thuyet-o-to.vercel.app` in Vercel. Do not include `/mcp` or a trailing slash.

WorkOS must issue tokens whose `aud` claim is exactly the MCP URL above. The server verifies the signature, issuer, audience, expiry, and account subject on every protected request. See the [WorkOS MCP setup guide](https://workos.com/docs/authkit/mcp) and [OpenAI plugin authentication guide](https://developers.openai.com/plugins/build/auth) for the provider settings.

## Connect and test

After setting all three environment variables, redeploy the Vercel project. Check that `/.well-known/oauth-protected-resource/mcp` names the WorkOS issuer and that an unauthenticated `/mcp` request returns `401` with `WWW-Authenticate`.

In [ChatGPT Plugins](https://chatgpt.com/plugins), refresh or recreate the connection to `https://chatgpt-plugin-hoc-ly-thuyet-o-to.vercel.app/mcp`. Choose OAuth when the connection form asks for authentication, then complete the WorkOS login. In a new chat, ask: `Cho tôi luyện câu q301, đừng tiết lộ đáp án trước khi tôi chọn.` Answer the question and ask: `Tiến độ của tôi và các câu cần ôn hôm nay là gì?` Start another chat with the same connection and confirm that the attempt still appears. A second learner account must show its own progress.

The standalone `/play` page is an anonymous question-bank demo. Saved reviews belong to the authenticated ChatGPT connection.
