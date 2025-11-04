// tests/api.classes.spec.js
import { describe, it, expect } from "vitest";
import request from "supertest";
import { buildApp } from "../apps/api/server.js";

const app = buildApp();

describe("Classes endpoints", () => {
  let code = "CSE" + Math.floor(Math.random()*10000);

  it("list classes", async () => {
    const res = await request(app).get("/api/v1/classes");
    expect(res.statusCode).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it("create/read/update/delete class", async () => {
    const created = await request(app).post("/api/v1/classes").send({ code, title: "Demo", instructor: "Prof Z", tags: ["advanced"] });
    expect(created.statusCode).toBe(201);

    const got = await request(app).get(`/api/v1/classes/${code}`);
    expect(got.statusCode).toBe(200);

    const upd = await request(app).put(`/api/v1/classes/${code}`).send({ title: "Demo 2" });
    expect(upd.statusCode).toBe(200);
    expect(upd.body.title).toBe("Demo 2");

    const del = await request(app).delete(`/api/v1/classes/${code}`);
    expect(del.statusCode).toBe(200);
  });
});
