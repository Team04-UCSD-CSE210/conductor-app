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
        }
      } catch (err) {
        console.warn('Error fetching /api/offerings/active', err);
      }
    }
  } catch (e) {
    console.err('Error determining active offering:', e);
  }

  if (!offeringId) return { teams: [], offeringId: null };

  const res = await fetch(`/api/teams?offering_id=${offeringId}&includeStats=true`, { credentials: 'include' });
  if (!res.ok) {
    console.error('Teams API request failed:', res.status, res.statusText);
    return { teams: [], offeringId };
  }
  const result = await res.json();
  // API returns { teams: [...] }
  return { teams: result.teams || [], offeringId };
}


async function renderTeams() {
  const container = document.getElementById('team-list');
  container.innerHTML = '<p style="text-align:center; color:#888;">Loading teams...</p>';
  
  try {
    const { teams, offeringId } = await fetchTeams();
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
    
    // Fetch all meetings for all teams in parallel
    const teamMeetingsPromises = teams.map(team => fetchMeetings(team.id, offeringId));
    const allMeetings = await Promise.all(teamMeetingsPromises);
    
    // Collect all closed session IDs for batch statistics fetch
    const closedSessionIds = [];
    const teamMeetingsMap = new Map();
    
    teams.forEach((team, index) => {
      const meetings = allMeetings[index] || [];
      const teamMeetings = meetings.filter(m => m.team_id === team.id);
      teamMeetingsMap.set(team.id, teamMeetings);
      
      // Collect closed session IDs
      teamMeetings.forEach(meeting => {
        const status = determineMeetingStatus(meeting);
        if (status === 'closed') {
          closedSessionIds.push(meeting.id);
        }
      });
    });
    
    // Batch fetch all statistics in ONE request
    let statsMap = {};
    if (closedSessionIds.length > 0) {
      const statsRes = await fetch(
        `/api/attendance/sessions/batch/statistics?session_ids=${closedSessionIds.join(',')}`,
        { credentials: 'include' }
      );
      
      if (statsRes.ok) {
        statsMap = await statsRes.json();
      } else {
        const errorText = await statsRes.text();
        console.warn('Failed to fetch batch statistics:', statsRes.status, errorText);
      }
    }
    
    // Render all team rows with pre-fetched statistics
    for (const team of teams) {
      const teamMeetings = teamMeetingsMap.get(team.id) || [];
      const teamSize = Number(team.member_count || team.members?.length || 0);
      let totalAttendance = 0;
      let totalPossible = 0;
      
      // Calculate attendance from batch stats
      for (const meeting of teamMeetings) {
        const status = determineMeetingStatus(meeting);
        
        if (status === 'closed') {
          const stats = statsMap[meeting.id];
          if (stats) {
            totalAttendance += stats.present_count || 0;
            totalPossible += teamSize;
          } else {
            totalPossible += teamSize;
          }
        }
      }
      
      const percent = totalPossible > 0 ? Math.round((totalAttendance / totalPossible) * 100) : 0;
      
      const memberCount = team.member_count || team.members?.length || 0;
      const meetingCount = teamMeetings.length;
      
      const row = document.createElement('a');
      row.className = 'attendance-card-list';
      row.href = `/instructor-team-meetings.html?team_id=${encodeURIComponent(team.id)}&offering_id=${encodeURIComponent(offeringId)}`;
      row.style.textDecoration = 'none';
      row.style.color = 'inherit';
      row.innerHTML = `
        <span class="attendance-card-list-label">${team.name || 'Team ' + team.team_number}</span>
        <span class="attendance-members">${memberCount} ${memberCount === 1 ? 'member' : 'members'}</span>
        <div class="attendance-card-list-row">
          <span class="attendance-text">Attendance:</span>
          <span class="attendance-bar">
            <span class="attendance-fill" style="width:${percent}%"></span>
            <span class="attendance-label">${percent}%</span>
          </span>
        </div>
        <span class="attendance-meetings">${meetingCount} ${meetingCount === 1 ? 'meeting' : 'meetings'}</span>
      `;
      
      container.appendChild(row);
    }
  } catch (error) {
    console.error('Error rendering teams:', error);
    container.innerHTML = '<p style="color:red;">Error loading teams. Please try again.</p>';
  }
}

function initHamburger() {
  const hamburger = document.querySelector('.hamburger-menu');
  const sidebar = document.querySelector('.sidebar');
  const body = document.body;
  if (!hamburger || !sidebar) return;

  hamburger.addEventListener('click', () => {
    const isOpen = hamburger.getAttribute('aria-expanded') === 'true';
    hamburger.setAttribute('aria-expanded', String(!isOpen));
    sidebar.classList.toggle('open');
    body.classList.toggle('menu-open');
  });

  document.addEventListener('click', (e) => {
    if (window.innerWidth <= 768 &&
        sidebar.classList.contains('open') &&
        !sidebar.contains(e.target) &&
        !hamburger.contains(e.target)) {
      hamburger.setAttribute('aria-expanded', 'false');
      sidebar.classList.remove('open');
      body.classList.remove('menu-open');
    }
  });
}

document.addEventListener('DOMContentLoaded', () => {
  initHamburger();
  renderTeams();
});
