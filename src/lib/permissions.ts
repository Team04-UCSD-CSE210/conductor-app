// src/lib/permissions.ts
import { pool } from "../db";

type PermissionContext =
  | { offeringId: string; teamId?: undefined }
  | { teamId: string; offeringId?: undefined };

export async function can(
  userId: string,
  resource: string,
  action: string,
  context: PermissionContext
): Promise<boolean> {
  if (!userId) return false;

  // Team-scoped
  if ("teamId" in context && context.teamId) {
    const { rows } = await pool.query<{ allowed: boolean }>(
      "SELECT can_user_do_team_action($1, $2, $3, $4) AS allowed",
      [userId, context.teamId, resource, action]
    );
    return !!rows[0]?.allowed;
  }

  // Course-scoped
  if ("offeringId" in context && context.offeringId) {
    const { rows } = await pool.query<{ allowed: boolean }>(
      "SELECT can_user_do_course_action($1, $2, $3, $4) AS allowed",
      [userId, context.offeringId, resource, action]
    );
    return !!rows[0]?.allowed;
  }

  // No context → deny for now
  return false;
}

export function canForCourse(
  userId: string,
  offeringId: string,
  resource: string,
  action: string
): Promise<boolean> {
  return can(userId, resource, action, { offeringId });
}

export function canForTeam(
  userId: string,
  teamId: string,
  resource: string,
  action: string
): Promise<boolean> {
  return can(userId, resource, action, { teamId });
}
