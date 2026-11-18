import assert from "node:assert/strict";
import { generateKeyPairSync, verify } from "node:crypto";
import test from "node:test";
import {
  createAppJwt,
  chooseGitHubInstallation,
  githubAuthorizeUrl,
  githubPopupHtml,
  githubStateMatches,
  normalizePrivateKey,
} from "../src/lib/github/app-core.ts";

test("GitHub App JWT has the expected claims and a valid RS256 signature", () => {
  const { privateKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
  const pem = privateKey.export({ type: "pkcs8", format: "pem" }).toString();
  const jwt = createAppJwt("12345", pem, 1_700_000_000);
  const [encodedHeader, encodedClaims, encodedSignature] = jwt.split(".");

  assert.deepEqual(JSON.parse(Buffer.from(encodedHeader, "base64url").toString()), { alg: "RS256", typ: "JWT" });
  assert.deepEqual(JSON.parse(Buffer.from(encodedClaims, "base64url").toString()), {
    iat: 1_699_999_940,
    exp: 1_700_000_540,
    iss: "12345",
  });
  assert.equal(
    verify("RSA-SHA256", Buffer.from(`${encodedHeader}.${encodedClaims}`), publicKey, Buffer.from(encodedSignature, "base64url")),
    true,
  );
});

test("GitHub installation choice follows the repository owner", () => {
  const secret = { installations: [{ id: 1, account: "Personal" }, { id: 2, account: "Acme" }] };
  assert.deepEqual(chooseGitHubInstallation(secret, "acme/site"), { id: 2, account: "Acme" });
  assert.deepEqual(chooseGitHubInstallation(secret, "PERSONAL/site"), { id: 1, account: "Personal" });
  assert.deepEqual(chooseGitHubInstallation(secret), { id: 1, account: "Personal" });
  assert.deepEqual(chooseGitHubInstallation(secret, "missing/site"), { id: 1, account: "Personal" });
});

test("GitHub installation choice supports the legacy installationId shape", () => {
  assert.deepEqual(chooseGitHubInstallation({ installationId: 42 }), { id: 42, account: "" });
  assert.deepEqual(chooseGitHubInstallation({ installationId: 42 }, "acme/site"), { id: 42, account: "" });
});

test("GitHub popup HTML safely embeds its postMessage payload", () => {
  const html = githubPopupHtml("error", "bad</script><script>alert(1)</script>");
  assert.match(html, /postMessage\(\{"type":"kismet-github","status":"error","error":"bad\\u003c/);
  assert.doesNotMatch(html, /bad<\/script>/);
  assert.match(html, /window\.location\.origin/);
});

test("GitHub App private keys normalize literal newline sequences", () => {
  assert.equal(normalizePrivateKey("first\\nsecond\\n"), "first\nsecond\n");
});

test("GitHub App state rejects mismatches", () => {
  assert.equal(githubStateMatches("same-state", "same-state"), true);
  assert.equal(githubStateMatches("same-state", "other-state"), false);
  assert.equal(githubStateMatches("short", "a-much-longer-state"), false);
  assert.equal(githubStateMatches(undefined, "state"), false);
});

test("GitHub authorize URL asks GitHub who the person is and returns to Kismet's callback", () => {
  const url = githubAuthorizeUrl("Iv1.abc", "s1", "https://app.example.com/api/github/app/callback");
  assert.equal(url.origin + url.pathname, "https://github.com/login/oauth/authorize");
  assert.equal(url.searchParams.get("client_id"), "Iv1.abc");
  assert.equal(url.searchParams.get("state"), "s1");
  assert.equal(url.searchParams.get("redirect_uri"), "https://app.example.com/api/github/app/callback");
});
