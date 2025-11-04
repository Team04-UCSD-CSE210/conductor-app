// tests/api.health.spec.js
import { describe, it, expect } from "vitest";
import request from "supertest";
import { buildApp } from "../apps/api/server.js";

const app = buildApp();

describe("API Health Checks", () => {
  it("GET /health returns ok", async () => {
    const res = await request(app).get("/api/v1/health");
    expect(res.statusCode).toBe(200);
    expect(res.body.ok).toBe(true);
  });

  it("GET /api/v1/status returns ok with system info", async () => {
    const res = await request(app).get("/api/v1/status");
    expect(res.statusCode).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.service).toBe("api");
  });
});
