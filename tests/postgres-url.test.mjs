import { test } from "node:test";
import assert from "node:assert/strict";
import { databaseLabel, postgresUrl } from "../src/lib/postgres/url.ts";

test("a postgres URL keeps the database name", () => {
  const url = "postgresql://reader:secret@db.example.com:5432/warehouse";
  assert.equal(postgresUrl(url), url);
  assert.equal(databaseLabel(url), "warehouse");
});

test("a web address is not a database URL", () => {
  assert.equal(postgresUrl("https://abcd.supabase.co"), null);
  assert.equal(postgresUrl("postgres://db.example.com"), null);
});
