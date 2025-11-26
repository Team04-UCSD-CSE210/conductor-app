// instructor-team-meetings.js
// Renders team details and meetings for instructor-team-meetings.html

async function getParams() {
  const params = new URLSearchParams(window.location.search);
  return {
    teamId: params.get('team_id'),
    offeringId: params.get('offering_id')
  };
}

async function fetchTeam(teamId, offeringId) {
  if (!teamId || !offeringId) return null;
  const res = await fetch(`/api/teams/${teamId}?offering_id=${offeringId}`, { credentials: 'include' });
  if (!res.ok) return null;
  return await res.json();
}

async function fetchMeetings(teamId, offeringId) {
  if (!teamId || !offeringId) return [];
  const res = await fetch(`/api/sessions/team/${teamId}?offering_id=${offeringId}`, { credentials: 'include' });
  if (!res.ok) return [];
  return await res.json();
}

function formatTimeRange(startIso, endIso) {
  if (!startIso || !endIso) return '—';
  try {
    const start = new Date(startIso);
    const end = new Date(endIso);
    return `${start.toLocaleDateString()} ${start.toLocaleTimeString()}–${end.toLocaleTimeString()}`;
  } catch {
    return '—';
  }
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
    return;
  }
  for (const meeting of meetings) {
    const row = document.createElement('div');
    row.className = 'meeting-row';
    row.innerHTML = `
      <span class="meeting-title">${meeting.title || meeting.label || 'Meeting'}</span>
      <span class="meeting-time">${formatTimeRange(meeting.startsAt, meeting.endsAt)}</span>
      <span class="meeting-attendance" id="attendance-${meeting.id}" style="margin-top:0.5rem;color:#444;font-size:0.98rem;">Loading attendance...</span>
    `;
    list.appendChild(row);
    // Fetch and display X/Y attended (Y = team size)
    fetch(`/api/attendance/sessions/${meeting.id}/statistics`, { credentials: 'include' })
      .then(res => res.ok ? res.json() : null)
      .then(stats => {
        const el = document.getElementById(`attendance-${meeting.id}`);
        if (el && stats) {
          const present = stats.present_count || 0;
          el.textContent = `${present} / ${teamSize} attended`;
        } else if (el) {
          el.textContent = 'Attendance unavailable';
        }
      })
      .catch(() => {
        const el = document.getElementById(`attendance-${meeting.id}`);
        if (el) el.textContent = 'Attendance unavailable';
      });
  }
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
