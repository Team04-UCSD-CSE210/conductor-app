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

function renderMeetings(meetings) {
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
    `;
    list.appendChild(row);
  }
}

async function renderPage() {
  const { teamId, offeringId } = await getParams();
  if (!teamId || !offeringId) {
    document.getElementById('team-title').textContent = 'Team Meetings';
    document.getElementById('team-meta').textContent = 'Missing team or offering id.';
    return;
  }
  const team = await fetchTeam(teamId, offeringId);
  if (team) {
    document.getElementById('team-title').textContent = team.name || `Team ${team.team_number}`;
    renderTeamMeta(team);
  }
  const meetings = await fetchMeetings(teamId, offeringId);
  renderMeetings(meetings);
}

document.addEventListener('DOMContentLoaded', renderPage);
