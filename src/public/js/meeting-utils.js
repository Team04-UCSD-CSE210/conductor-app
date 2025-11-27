/**
 * Shared utility functions for meeting-related operations
 * Used by instructor-meetings.js and instructor-team-meetings.js
 */

/**
 * Determine the status of a meeting based on current time and meeting timestamps
 * @param {Object} meeting - Meeting object with session_date, session_time, attendance timestamps
 * @returns {string} - 'pending', 'open', or 'closed'
 */
export function determineMeetingStatus(meeting) {
  const now = new Date();
  
  // Priority 1: If attendance has been explicitly opened, ignore scheduled time
  if (meeting.attendance_opened_at) {
    const openTime = new Date(meeting.attendance_opened_at);
    
    // Check if there's a close time
    if (meeting.attendance_closed_at) {
      const closeTime = new Date(meeting.attendance_closed_at);
      if (now >= closeTime) {
        return 'closed';
      }
      if (now >= openTime && now < closeTime) {
        return 'open';
      }
      // Current time is before open time - should not happen but treat as pending
      return 'pending';
    }
    
    // No close time set - check if code has expired
    if (meeting.code_expires_at) {
      const endTime = new Date(meeting.code_expires_at);
      if (endTime < now) {
        return 'closed';
      }
    }
    
    // Attendance is opened and not closed - always open
    return 'open';
  }
  
  // Priority 2: Check scheduled time for meetings without explicit attendance timestamps
  if (meeting.session_date && meeting.session_time) {
    const sessionDate = new Date(meeting.session_date);
    const year = sessionDate.getFullYear();
    const month = sessionDate.getMonth();
    const day = sessionDate.getDate();
    const [hours, minutes] = meeting.session_time.split(':').map(Number);
    const scheduledStartTime = new Date(year, month, day, hours, minutes);
    
    // If scheduled start time is in the future, it's pending
    if (scheduledStartTime > now) {
      return 'pending';
    }
    // Scheduled time has passed but no attendance opened - closed
    return 'closed';
  }
  
  return 'pending';
}

/**
 * Fetch meetings for a specific team
 * @param {string} teamId - Team ID
 * @param {string} offeringId - Offering ID
 * @returns {Promise<Array>} - Array of meeting objects
 */
export async function fetchMeetings(teamId, offeringId) {
  if (!teamId || !offeringId) return [];
  const res = await fetch(`/api/sessions/team/${teamId}?offering_id=${offeringId}`, { credentials: 'include' });
  if (!res.ok) return [];
  return await res.json();
}

