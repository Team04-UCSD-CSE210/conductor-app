// tests/api.misc.spec.js
import { describe, it, expect } from "vitest";
import request from "supertest";
import { buildApp } from "../apps/api/server.js";

const app = buildApp();

describe("Misc route behavior", () => {
  it("returns 404 for unknown endpoints", async () => {
    const res = await request(app).get("/random/unknown");
    expect(res.statusCode).toBe(404);
  });
});
