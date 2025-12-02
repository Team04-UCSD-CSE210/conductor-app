// instructor-team-meetings.js
// Renders team details and meetings for instructor-team-meetings.html

import { determineMeetingStatus, fetchMeetings } from './meeting-utils.js';

async function getParams() {
  const params = new URLSearchParams(window.location.search);
  return {
    teamId: params.get('team_id'),
    offeringId: params.get('offering_id')
  };
}

function initBackButton() {
  const backBtn = document.querySelector('.header-back-button');
  if (!backBtn) return;
  backBtn.addEventListener('click', () => {
    window.location.href = '/instructor-meetings';
  });
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
  let statsPromises = [];
  for (const meeting of meetings) {
    const row = document.createElement('article');
    row.className = 'attendance-card';
    
    // Format date and time using session_date and session_time (same as team leader view)
    let timeStr = 'TBD';
    
    if (meeting.session_date && meeting.session_time) {
      // Parse session_date using UTC components to avoid timezone issues
      const sessionDate = new Date(meeting.session_date);
      const year = sessionDate.getUTCFullYear();
      const month = sessionDate.getUTCMonth();
      const day = sessionDate.getUTCDate();
      
      // Parse time
      const [hours, minutes] = meeting.session_time.split(':').map(Number);
      const startTime = new Date(year, month, day, hours, minutes);
      
      const dateFormatter = new Intl.DateTimeFormat('en-US', { 
        month: 'short', 
        day: 'numeric', 
        year: 'numeric'
      });
      const timeFormatter = new Intl.DateTimeFormat('en-US', { 
        hour: 'numeric', 
        minute: 'numeric'
      });
      
      const dateStr = dateFormatter.format(startTime);
      const startTimeStr = timeFormatter.format(startTime);
      
      // Add end time if available from attendance timestamps
      if (meeting.attendance_closed_at) {
        let endTime = new Date(meeting.attendance_closed_at);
        
        // If end time appears to be before start time on same day, it's likely next day
        if (endTime <= startTime) {
          const startDate = new Date(startTime);
          startDate.setHours(0, 0, 0, 0);
          const endDate = new Date(endTime);
          endDate.setHours(0, 0, 0, 0);
          
          // If same calendar day but earlier time, add 24 hours
          if (startDate.getTime() === endDate.getTime()) {
            endTime = new Date(endTime.getTime() + 24 * 60 * 60 * 1000);
          }
        }
        
        const endDateStr = dateFormatter.format(endTime);
        const endTimeStr = timeFormatter.format(endTime);
        
        // Show date only if different
        if (endDateStr !== dateStr) {
          timeStr = `${dateStr} ${startTimeStr} – ${endDateStr} ${endTimeStr}`;
        } else {
          timeStr = `${dateStr} ${startTimeStr}–${endTimeStr}`;
        }
      } else if (meeting.code_expires_at) {
        let endTime = new Date(meeting.code_expires_at);
        
        // If end time appears to be before start time on same day, it's likely next day
        if (endTime <= startTime) {
          const startDate = new Date(startTime);
          startDate.setHours(0, 0, 0, 0);
          const endDate = new Date(endTime);
          endDate.setHours(0, 0, 0, 0);
          
          // If same calendar day but earlier time, add 24 hours
          if (startDate.getTime() === endDate.getTime()) {
            endTime = new Date(endTime.getTime() + 24 * 60 * 60 * 1000);
          }
        }
        
        const endDateStr = dateFormatter.format(endTime);
        const endTimeStr = timeFormatter.format(endTime);
        
        // Show date only if different
        if (endDateStr !== dateStr) {
          timeStr = `${dateStr} ${startTimeStr} – ${endDateStr} ${endTimeStr}`;
        } else {
          timeStr = `${dateStr} ${startTimeStr}–${endTimeStr}`;
        }
      } else {
        // No end time available
        timeStr = `${dateStr} ${startTimeStr}`;
      }
    }
    
    row.innerHTML = `
      <span class="attendance-card-label">${meeting.title || meeting.label || 'Meeting'}</span>
      <div class="attendance-card-meta">
      <span class="attendance-percent" id="attendance-${meeting.id}" style="margin-top:0.5rem;color:#444;font-size:0.98rem;">Loading attendance...</span>
      <span class="attendance-schedule">${timeStr}</span>
      </div>
    `;
    list.appendChild(row);
    
    // Determine if meeting is closed using the same logic as team leader view
    const status = determineMeetingStatus(meeting);
    const isClosed = status === 'closed';
    
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
          return { present, isClosed };
        })
        .catch(() => ({ present: 0, isClosed: false }))
    );
  }
  // After all stats loaded, calculate overall attendance (only count closed meetings)
  Promise.all(statsPromises).then(results => {
    let totalPresent = 0;
    let totalPossible = 0;
    
    results.forEach(result => {
      if (result.isClosed) {
        totalPresent += result.present;
        totalPossible += teamSize;
      }
    });
    
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
    document.getElementById('header-title').textContent = team.name || `Team ${team.team_number}`;
    renderTeamMeta(team);
    teamSize = Array.isArray(team.members) ? team.members.length : 0;
  }
  const meetings = await fetchMeetings(teamId, offeringId);
  renderMeetings(meetings, teamSize);
  initBackButton();
}

document.addEventListener('DOMContentLoaded', renderPage);
