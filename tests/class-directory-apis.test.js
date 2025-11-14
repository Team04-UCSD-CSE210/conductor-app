// tests/class-directory-apis.test.js
// Node built-in test runner (node:test) for Class Directory – User Cards APIs.
//
// NOTE:
//   1) The server must be running on http://localhost:8080
//      (e.g. `set NODE_ENV=development && npm start` in another terminal).
//   2) This file is executed by:
//         node --test --experimental-test-coverage tests/class-directory-apis.test.js

import test from "node:test";
import assert from "node:assert/strict";

const BASE_URL = "http://localhost:8080";

// Simple helper used by all tests.
// Every line in this function will be executed, which helps coverage.
async function requestJson(path) {
  const res = await fetch(`${BASE_URL}${path}`);
  const body = await res.json();
  return { status: res.status, body };
}

// 1) Professors endpoint
test("Class Directory: GET /api/class/1/professor returns professors array", async () => {
  const { status, body } = await requestJson("/api/class/1/professor");

  assert.equal(status, 200, "professor endpoint should return HTTP 200");
  assert.ok(body, "response body should not be null or undefined");
  assert.ok(
    Array.isArray(body.professors),
    '"professors" field should be an array'
  );
});

// 2) TAs endpoint
test("Class Directory: GET /api/class/1/tas returns tas array", async () => {
  const { status, body } = await requestJson("/api/class/1/tas");

  assert.equal(status, 200, "tas endpoint should return HTTP 200");
  assert.ok(body, "response body should not be null or undefined");
  assert.ok(Array.isArray(body.tas), '"tas" field should be an array');
});

// 3) Single TA endpoint
test("Class Directory: GET /api/class/ta/1 returns a TA object", async () => {
  const { status, body } = await requestJson("/api/class/ta/1");

  assert.equal(status, 200, "single TA endpoint should return HTTP 200");
  assert.ok(body, "response body should not be null or undefined");
  assert.ok(
    Object.prototype.hasOwnProperty.call(body, "userId"),
    "TA object should contain userId"
  );
});

// 4) Students endpoint
test("Class Directory: GET /api/class/1/students returns students array", async () => {
  const { status, body } = await requestJson(
    "/api/class/1/students?page=1&limit=10"
  );

  assert.equal(status, 200, "students endpoint should return HTTP 200");
  assert.ok(body, "response body should not be null or undefined");
  assert.ok(
    Array.isArray(body.students),
    '"students" field should be an array'
  );
});
