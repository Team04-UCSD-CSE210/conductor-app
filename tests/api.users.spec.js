// tests/api.users.spec.js
import { describe, it, expect, } from "vitest";
import request from "supertest";
import { buildApp } from "../apps/api/server.js";

const app = buildApp();

describe("Users CRUD", () => {
  let created;
  it("list users", async () => {
    const res = await request(app).get("/api/v1/users");
    expect(res.statusCode).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it("create user", async () => {
    const res = await request(app).post("/api/v1/users").send({ name: "Alice", email: "a@example.com" });
    expect(res.statusCode).toBe(201);
    created = res.body;
    expect(created.name).toBe("Alice");
  });

  it("read/update/delete user", async () => {
    const show = await request(app).get(`/api/v1/users/${created.id}`);
    expect(show.statusCode).toBe(200);
    const upd = await request(app).put(`/api/v1/users/${created.id}`).send({ name: "Alice Z" });
    expect(upd.statusCode).toBe(200);
    expect(upd.body.name).toBe("Alice Z");
    const del = await request(app).delete(`/api/v1/users/${created.id}`);
    expect(del.statusCode).toBe(200);
  });
});
