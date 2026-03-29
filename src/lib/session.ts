import { SignJWT, jwtVerify } from "jose";

const COOKIE = "algo-token";

function getSecretKey() {
  return new TextEncoder().encode(
    process.env.AUTH_SECRET ?? "dev-only-insecure-fallback",
  );
}

export async function signSession(username: string, userId: string) {
  return new SignJWT({ sub: userId, name: username })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(getSecretKey());
}

export async function verifySessionToken(token: string) {
  const { payload } = await jwtVerify(token, getSecretKey());
  return payload as { sub: string; name: string };
}

export { COOKIE };
