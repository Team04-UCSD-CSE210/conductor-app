import { pool } from '../db.js';

/**
 * Sync team.leader_ids array from team_members.role = 'leader'
 * This ensures leader_ids is always up-to-date after any team_members changes
 * 
 * @param {string} teamId - UUID of the team to sync
 * @returns {Promise<void>}
 */
export async function syncTeamLeaderIds(teamId) {
  try {
    // Get all current leaders for this team from team_members
    const { rows: leaderRows } = await pool.query(
      `SELECT ARRAY_AGG(DISTINCT user_id ORDER BY user_id) as leader_ids_array
       FROM team_members
       WHERE team_id = $1 
         AND role = 'leader'::team_member_role_enum 
         AND left_at IS NULL`,
      [teamId]
    );
    
    const leaderIdsArray = leaderRows[0]?.leader_ids_array || [];
    
    // Update team.leader_ids with the array (or empty array if no leaders)
    await pool.query(
      `UPDATE team 
       SET leader_ids = $1::UUID[]
       WHERE id = $2`,
      [leaderIdsArray, teamId]
    );
  } catch (error) {
    console.error('Error syncing team leader_ids:', error);
    // Don't throw - this is a sync operation, shouldn't break the main operation
  }
}
