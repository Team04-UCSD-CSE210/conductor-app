// instructor-meetings.js
// Handles fetching and rendering team meetings and attendance stats for instructor meetings overview page

async function fetchTeams() {
  let offeringId = null;
  try {
    const offeringRes = await fetch('/api/my-courses', { credentials: 'include' });
    if (offeringRes.ok) {
      const data = await offeringRes.json();
      // Find the active course offering
      if (data.courses && data.courses.length > 0) {
        const active = data.courses.find(c => c.offering.status === 'active' || c.offering.is_active);
        if (active) {
          offeringId = active.offering.id;
        } else {
          offeringId = data.courses[0].offering.id;
        }
      }
    } else {
      console.log('/api/my-courses request failed:', offeringRes.status, offeringRes.statusText);
    }
  } catch (e) {
    console.log('Error fetching /api/my-courses:', e);
  }
  if (!offeringId) return { teams: [], offeringId: null };
  const res = await fetch(`/api/teams?offering_id=${offeringId}&includeStats=true`, { credentials: 'include' });
  if (!res.ok) {
    console.log('Teams API request failed:', res.status, res.statusText);
    return { teams: [], offeringId };
  }
  const result = await res.json();
  // API returns { teams: [...] }
  return { teams: result.teams || [], offeringId };
}
async function fetchMeetings(teamId, offeringId) {
  if (!offeringId || !teamId) return [];
  const res = await fetch(`/api/sessions/team/${teamId}?offering_id=${offeringId}`, { credentials: 'include' });
  if (!res.ok) return [];
  return await res.json();
}

async function renderTeams() {
  const container = document.getElementById('team-list');
  container.innerHTML = '<p style="text-align:center; color:#888;">Loading teams...</p>';
  fetchTeams().then(({ teams, offeringId }) => {
    container.innerHTML = '';
    if (!teams || !Array.isArray(teams)) {
      container.innerHTML = '<p style="color:red;">Error: Could not fetch teams. Check your network and permissions.</p>';
      return;
    }
    if (!teams.length) {
      container.innerHTML = '<p style="text-align:center; color:#888;">No teams found.</p>';
      return;
    }
    for (const team of teams) {
      fetchMeetings(team.id, offeringId).then(async meetings => {
        // Filter out sessions where team_id is null
        const teamMeetings = meetings.filter(m => m.team_id === team.id);
        let totalAttendance = 0;
        let totalPossible = 0;
        for (const meeting of teamMeetings) {
          const statsRes = await fetch(`/api/attendance/sessions/${meeting.id}/statistics`, { credentials: 'include' });
          if (statsRes.ok) {
            const stats = await statsRes.json();
            totalAttendance += stats.present_count || 0;
            totalPossible += stats.total_marked || 0;
          }
        }
        const percent = totalPossible > 0 ? Math.round((totalAttendance / totalPossible) * 100) : 0;
        const row = document.createElement('div');
        row.className = 'team-row';
        row.innerHTML = `
          <span class="team-name">${team.name || 'Team ' + team.team_number}</span>
          <div class="team-meta">
            <span>Members: ${team.member_count || team.members?.length || 0}</span>
            <span>Meetings: ${teamMeetings.length}</span>
            <span style="display:flex;align-items:center;">Attendance:
              <span class="attendance-bar">
                <span class="attendance-fill" style="width:${percent}%"></span>
                <span class="attendance-label">${percent}%</span>
              </span>
            </span>
          </div>
        `;
        container.appendChild(row);
      });
    }
  });
}
document.addEventListener('DOMContentLoaded', renderTeams);
// End of file
