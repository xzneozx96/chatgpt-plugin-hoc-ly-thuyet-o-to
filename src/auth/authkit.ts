import { createHash } from "node:crypto";
import { createRemoteJWKSet, jwtVerify, type JWTVerifyGetKey } from "jose";

export interface AuthKitConfig {
  issuer: string;
  publicBaseUrl: string;
  databaseUrl: string;
}

export interface TokenVerifier {
  verify(token: string): Promise<{ issuer: string; subject: string; scopes: string[] }>;
}

export function readAuthKitConfig(env: NodeJS.ProcessEnv = process.env): AuthKitConfig | null {
  const values = [env.AUTHKIT_ISSUER, env.PUBLIC_BASE_URL, env.DATABASE_URL];
  if (!env.AUTHKIT_ISSUER && !env.DATABASE_URL) return null;
  if (values.some((value) => !value)) throw new Error("AUTH_CONFIGURATION_INCOMPLETE");
  const issuer = env.AUTHKIT_ISSUER!;
  const publicBaseUrl = env.PUBLIC_BASE_URL!;
  if (new URL(issuer).protocol !== "https:" || new URL(publicBaseUrl).protocol !== "https:") throw new Error("AUTH_URL_MUST_USE_HTTPS");
  return { issuer, publicBaseUrl: publicBaseUrl.replace(/\/+$/, ""), databaseUrl: env.DATABASE_URL! };
}

export function createAuthKitVerifier(
  config: AuthKitConfig,
  jwks: JWTVerifyGetKey = createRemoteJWKSet(new URL(`${config.issuer.replace(/\/$/, "")}/oauth2/jwks`))
): TokenVerifier {
  return {
    async verify(token) {
      const { payload } = await jwtVerify(token, jwks, {
        issuer: config.issuer,
        audience: `${config.publicBaseUrl}/mcp`
      });
      if (typeof payload.exp !== "number") throw new Error("TOKEN_EXPIRY_MISSING");
      if (typeof payload.sub !== "string" || !payload.sub) throw new Error("TOKEN_SUBJECT_MISSING");
      if (typeof payload.iss !== "string" || payload.iss !== config.issuer) throw new Error("TOKEN_ISSUER_MISMATCH");
      const scopes = typeof payload.scope === "string" ? payload.scope.split(/\s+/).filter(Boolean) : [];
      return { issuer: payload.iss, subject: payload.sub, scopes };
    }
  };
}

export function opaqueUserId(issuer: string, subject: string) {
  return createHash("sha256").update(`${issuer}\0${subject}`).digest("hex");
}

export async function authenticateBearer(authorization: string | undefined, verifier: TokenVerifier) {
  const match = authorization?.match(/^Bearer\s+([^\s]+)$/i);
  if (!match) throw new Error("BEARER_TOKEN_REQUIRED");
  const identity = await verifier.verify(match[1]!);
  if (!identity.scopes.includes("openid")) throw new Error("TOKEN_SCOPE_MISSING");
  return opaqueUserId(identity.issuer, identity.subject);
}
