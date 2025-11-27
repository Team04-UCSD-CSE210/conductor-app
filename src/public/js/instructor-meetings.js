// instructor-meetings.js
// Handles fetching and rendering team meetings and attendance stats for instructor meetings overview page

import { determineMeetingStatus, fetchMeetings } from './meeting-utils.js';

async function fetchTeams() {
  // 1) Use page-provided offering id (query string or meta)
  // 2) Fallback to the active-offering API (/api/offerings/active)
  let offeringId = null;
  try {
    const params = new URLSearchParams(window.location.search);
    if (params.has('offering_id')) offeringId = params.get('offering_id');
    if (!offeringId) {
      const meta = document.querySelector('meta[name="offering-id"]');
      if (meta?.content) offeringId = meta.content;
    }
  } catch {
    // ignore and continue
  }

  try {
    if (!offeringId) {
      // Call the active-offering API directly to determine the offering being viewed
      try {
        const offeringRes = await fetch('/api/offerings/active', { credentials: 'include' });
        if (offeringRes.ok) {
          const data = await offeringRes.json();
          offeringId = data?.id || null;
        } else {
          console.log('/api/offerings/active request failed:', offeringRes.status, offeringRes.statusText);
        }
      } catch (err) {
        console.warn('Error fetching /api/offerings/active', err);
      }
    }
  } catch (e) {
    console.log('Error determining active offering:', e);
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
    // Sort teams by team_number ascending
    teams.sort((a, b) => {
      const numA = a.team_number ?? 0;
      const numB = b.team_number ?? 0;
      return numA - numB;
    });
    // Collect all team row promises
    const teamRowPromises = teams.map(async team => {
      const meetings = await fetchMeetings(team.id, offeringId);
      const teamMeetings = meetings.filter(m => m.team_id === team.id);
      const teamSize = Number(team.member_count || team.members?.length || 0);
      let totalAttendance = 0;
      let totalPossible = 0;
      
      // Only count closed meetings (same logic as team leader view)
      for (const meeting of teamMeetings) {
        const status = determineMeetingStatus(meeting);
        
        if (status === 'closed') {
          const statsRes = await fetch(`/api/attendance/sessions/${meeting.id}/statistics`, { credentials: 'include' });
          if (statsRes.ok) {
            const stats = await statsRes.json();
            totalAttendance += stats.present_count || 0;
            totalPossible += teamSize;
          } else {
            totalPossible += teamSize;
          }
        }
      }
      const percent = totalPossible > 0 ? Math.round((totalAttendance / totalPossible) * 100) : 0;
      const row = document.createElement('a');
      row.className = 'team-row';
      row.href = `/instructor-team-meetings.html?team_id=${encodeURIComponent(team.id)}&offering_id=${encodeURIComponent(offeringId)}`;
      row.style.textDecoration = 'none';
      row.style.color = 'inherit';
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
      return row;
    });
    Promise.all(teamRowPromises).then(rows => {
      container.innerHTML = '';
      for (const row of rows) {
        container.appendChild(row);
      }
    });
  });
}
document.addEventListener('DOMContentLoaded', renderTeams);
// End of file
