"use strict";

const assert = require("node:assert/strict");
const { after, before, test } = require("node:test");
const { createServer } = require("./server");

const server = createServer();
let baseUrl;

before(async () => {
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  await new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
});

test("serves the app at the root path", async () => {
  const response = await fetch(baseUrl);

  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type"), /^text\/html; charset=utf-8$/);
  assert.match(await response.text(), /SortWise — Know where it goes/);
  assert.equal(response.headers.get("x-content-type-options"), "nosniff");
});

test("serves the browser assets", async () => {
  const [script, stylesheet] = await Promise.all([
    fetch(`${baseUrl}/app.js`),
    fetch(`${baseUrl}/styles.css`),
  ]);

  assert.equal(script.status, 200);
  assert.match(script.headers.get("content-type"), /^text\/javascript; charset=utf-8$/);
  assert.equal(stylesheet.status, 200);
  assert.match(stylesheet.headers.get("content-type"), /^text\/css; charset=utf-8$/);
});

test("reports a healthy service", async () => {
  const response = await fetch(`${baseUrl}/healthz`);

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { status: "ok" });
  assert.equal(response.headers.get("cache-control"), "no-store");
});

test("does not expose files outside the public app", async () => {
  const response = await fetch(`${baseUrl}/server.js`);

  assert.equal(response.status, 404);
});

test("rejects unsupported HTTP methods", async () => {
  const response = await fetch(baseUrl, { method: "POST" });

  assert.equal(response.status, 405);
  assert.equal(response.headers.get("allow"), "GET, HEAD");
});

test("supports HEAD requests without returning a body", async () => {
  const response = await fetch(baseUrl, { method: "HEAD" });

  assert.equal(response.status, 200);
  assert.ok(Number(response.headers.get("content-length")) > 0);
  assert.equal(await response.text(), "");
});
