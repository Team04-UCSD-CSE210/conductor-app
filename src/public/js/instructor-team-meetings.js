// instructor-team-meetings.js
// Renders team details and meetings for instructor-team-meetings.html

async function getParams() {
  const params = new URLSearchParams(window.location.search);
  return {
    teamId: params.get('team_id'),
    offeringId: params.get('offering_id')
  };
}

async function fetchMeetings(teamId, offeringId) {
  if (!teamId || !offeringId) return [];
  const res = await fetch(`/api/sessions/team/${teamId}?offering_id=${offeringId}`, { credentials: 'include' });
  if (!res.ok) return [];
  return await res.json();
}

function renderTeamMeta(team) {
  const meta = document.getElementById('team-meta');
  if (!meta || !team) return;
  meta.innerHTML = `
    <span class="wj-team-name">${team.name || 'Team ' + team.team_number}</span>
    <span>Members: ${team.member_count || team.members?.length || 0}</span>
    <span>Leader: ${team.leader_name || team.leader?.name || ''}</span>
  `;
}

function renderMeetings(meetings, teamSize) {
  const list = document.getElementById('meeting-list');
  if (!list) return;
  list.innerHTML = '';
  if (!meetings.length) {
    list.innerHTML = '<p style="color:#888;">No meetings found for this team.</p>';
    // Set overall attendance to 0%
    const overallEl = document.getElementById('overall-attendance-value');
    if (overallEl) overallEl.textContent = '0%';
    return;
  }
  let totalPresent = 0;
  let totalPossible = 0;
  let statsPromises = [];
  for (const meeting of meetings) {
    const row = document.createElement('div');
    row.className = 'meeting-row';
    // Hard-coded date and time for now
    const dateStr = '2025-11-26';
    const timeStr = '10:00 AM–11:00 AM';
    row.innerHTML = `
      <span class="meeting-title">${meeting.title || meeting.label || 'Meeting'}</span>
      <span class="meeting-date">${dateStr}</span>
      <span class="meeting-time">${timeStr}</span>
      <span class="meeting-attendance" id="attendance-${meeting.id}" style="margin-top:0.5rem;color:#444;font-size:0.98rem;">Loading attendance...</span>
    `;
    list.appendChild(row);
    // Collect stats promises for overall attendance
    statsPromises.push(
      fetch(`/api/attendance/sessions/${meeting.id}/statistics`, { credentials: 'include' })
        .then(res => res.ok ? res.json() : null)
        .then(stats => {
          const el = document.getElementById(`attendance-${meeting.id}`);
          let present = 0;
          if (el && stats) {
            present = stats.present_count || 0;
            el.textContent = `${present} / ${teamSize} attended`;
          } else if (el) {
            el.textContent = 'Attendance unavailable';
          }
          return present;
        })
        .catch(() => 0)
    );
    totalPossible += teamSize;
  }
  // After all stats loaded, calculate overall attendance
  Promise.all(statsPromises).then(presents => {
    totalPresent = presents.reduce((a, b) => a + b, 0);
    const percent = totalPossible > 0 ? Math.round((totalPresent / totalPossible) * 100) : 0;
    const overallEl = document.getElementById('overall-attendance-value');
    if (overallEl) overallEl.textContent = `${percent}%`;
  });
}

async function renderPage() {
  const { teamId, offeringId } = await getParams();
  if (!teamId || !offeringId) {
    document.getElementById('team-title').textContent = 'Team Meetings';
    document.getElementById('team-meta').textContent = 'Missing team or offering id.';
    return;
  }
  // Fetch team details from /api/teams/:teamId (team specific route)
  const teamRes = await fetch(`/api/teams/${teamId}?offering_id=${offeringId}`, { credentials: 'include' });
  let team = null;
  let teamSize = 0;
  if (teamRes.ok) {
    team = await teamRes.json();
    document.getElementById('team-title').textContent = team.name || `Team ${team.team_number}`;
    renderTeamMeta(team);
    teamSize = Array.isArray(team.members) ? team.members.length : 0;
  }
  const meetings = await fetchMeetings(teamId, offeringId);
  renderMeetings(meetings, teamSize);
}

document.addEventListener('DOMContentLoaded', renderPage);
