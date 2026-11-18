import { test } from "node:test";
import assert from "node:assert/strict";
import { pooledDatabase, projectRef, resolveDatabaseUrl } from "../src/lib/db/url.ts";

test("a pasted postgres URI is used as the database", () => {
  const url = "postgresql://postgres:secret@db.example.supabase.co:5432/postgres";
  assert.equal(resolveDatabaseUrl({ DATABASE_URL: url }), url);
});

test("a project URL and password build the direct connection", () => {
  const url = resolveDatabaseUrl({
    SUPABASE_URL: "https://abcd1234.supabase.co",
    SUPABASE_DB_PASSWORD: "p@ss word",
    SUPABASE_REGION: "us-east-1",
  });
  assert.equal(url, "postgresql://postgres:p%40ss%20word@db.abcd1234.supabase.co:5432/postgres");
  assert.equal(pooledDatabase(url ?? ""), false);
});

test("the project page is not treated as a postgres URI", () => {
  assert.equal(resolveDatabaseUrl({ DATABASE_URL: "https://abcd1234.supabase.co" }), null);
  assert.equal(projectRef("https://abcd1234.supabase.co"), "abcd1234");
  assert.equal(projectRef("https://db.abcd1234.supabase.co"), null);
});
