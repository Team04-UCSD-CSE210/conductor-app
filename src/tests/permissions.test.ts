// src/tests/permissions.test.ts
import { describe, it, expect, beforeEach, vi } from "vitest";
import { canForCourse, canForTeam } from "../services/permissions";
import { pool } from "../db";

// Mock ../db BEFORE using canForCourse/canForTeam logic
vi.mock("../db", () => {
  return {
    pool: {
      query: vi.fn(),
    },
  };
});

const mockedPool = pool as unknown as { query: ReturnType<typeof vi.fn> };

describe("permissions canForCourse", () => {
  beforeEach(() => {
    mockedPool.query.mockReset();
  });

  it("returns true when DB function allows", async () => {
    mockedPool.query.mockResolvedValueOnce({ rows: [{ allowed: true }] });

    const allowed = await canForCourse(
      "user-1",
      "offering-1",
      "roster",
      "view"
    );

    expect(mockedPool.query).toHaveBeenCalledWith(
      "SELECT can_user_do_course_action($1, $2, $3, $4) AS allowed",
      ["user-1", "offering-1", "roster", "view"]
    );
    expect(allowed).toBe(true);
  });

  it("returns false when DB function denies", async () => {
    mockedPool.query.mockResolvedValueOnce({ rows: [{ allowed: false }] });

    const allowed = await canForCourse(
      "user-2",
      "offering-1",
      "roster",
      "manage"
    );

    expect(allowed).toBe(false);
  });
});

describe("permissions canForTeam", () => {
  beforeEach(() => {
    mockedPool.query.mockReset();
  });

  it("calls team function and returns true", async () => {
    mockedPool.query.mockResolvedValueOnce({ rows: [{ allowed: true }] });

    const allowed = await canForTeam(
      "user-1",
      "team-1",
      "team",
      "manage_own"
    );

    expect(mockedPool.query).toHaveBeenCalledWith(
      "SELECT can_user_do_team_action($1, $2, $3, $4) AS allowed",
      ["user-1", "team-1", "team", "manage_own"]
    );
    expect(allowed).toBe(true);
  });
});
