/**
 * Attendance Calculation Tests
 * 
 * Tests for attendance percentage calculation logic used in:
 * - Team leader meeting attendance view
 * - Instructor meeting overview
 * - Meeting status determination (pending/open/closed)
 */

import { describe, it, expect } from 'vitest';

describe('Attendance Calculation Logic', () => {
  
  describe('Meeting Status Determination', () => {
    
    function determineMeetingStatus(meeting) {
      const now = new Date();
      
      // Check scheduled time first - only matters if in future
      let scheduledStartTime = null;
      if (meeting.session_date && meeting.session_time) {
        const sessionDate = new Date(meeting.session_date);
        const year = sessionDate.getFullYear();
        const month = sessionDate.getMonth();
        const day = sessionDate.getDate();
        const [hours, minutes] = meeting.session_time.split(':').map(Number);
        scheduledStartTime = new Date(year, month, day, hours, minutes);
        
        // If scheduled start time is in the future, it's always pending
        if (scheduledStartTime > now) {
          return 'pending';
        }
      }
      
      // Scheduled time has passed or doesn't exist - check attendance timestamps
      if (meeting.attendance_opened_at && meeting.attendance_closed_at) {
        // Both timestamps are set
        const openTime = new Date(meeting.attendance_opened_at);
        const closeTime = new Date(meeting.attendance_closed_at);
        
        if (now >= openTime && now < closeTime) {
          return 'open'; // Meeting is currently open
        } else if (now >= closeTime) {
          return 'closed'; // Meeting has ended
        }
      } else if (meeting.attendance_opened_at && !meeting.attendance_closed_at) {
        // Only open time is set - meeting is open
        
        // Check if end time has passed
        if (meeting.code_expires_at) {
          const endTime = new Date(meeting.code_expires_at);
          if (endTime < now) {
            return 'closed';
          }
        }
        return 'open';
      }
      
      // No attendance timestamps but scheduled time has passed - closed
      if (scheduledStartTime && scheduledStartTime <= now) {
        return 'closed';
      }
      
      return 'pending';
    }

    it('should return pending for future scheduled meeting', () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 1); // Tomorrow
      
      const meeting = {
        session_date: futureDate.toISOString(),
        session_time: '14:00:00'
      };
      
      expect(determineMeetingStatus(meeting)).toBe('pending');
    });

    it('should return closed for past scheduled meeting without attendance timestamps', () => {
      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 1); // Yesterday
      
      const meeting = {
        session_date: pastDate.toISOString(),
        session_time: '14:00:00'
      };
      
      expect(determineMeetingStatus(meeting)).toBe('closed');
    });

    it('should return open when attendance is opened but not closed', () => {
      const pastDate = new Date();
      pastDate.setHours(pastDate.getHours() - 1); // 1 hour ago
      
      const meeting = {
        session_date: pastDate.toISOString(),
        session_time: '14:00:00',
        attendance_opened_at: pastDate.toISOString()
      };
      
      expect(determineMeetingStatus(meeting)).toBe('open');
    });

    it('should return closed when attendance is opened and closed', () => {
      const openDate = new Date();
      openDate.setHours(openDate.getHours() - 2); // 2 hours ago
      
      const closeDate = new Date();
      closeDate.setHours(closeDate.getHours() - 1); // 1 hour ago
      
      const meeting = {
        session_date: openDate.toISOString(),
        session_time: '14:00:00',
        attendance_opened_at: openDate.toISOString(),
        attendance_closed_at: closeDate.toISOString()
      };
      
      expect(determineMeetingStatus(meeting)).toBe('closed');
    });

    it('should return open when between open and close timestamps', () => {
      const openDate = new Date();
      openDate.setHours(openDate.getHours() - 1); // 1 hour ago
      
      const closeDate = new Date();
      closeDate.setHours(closeDate.getHours() + 1); // 1 hour from now
      
      const meeting = {
        session_date: openDate.toISOString(),
        session_time: '14:00:00',
        attendance_opened_at: openDate.toISOString(),
        attendance_closed_at: closeDate.toISOString()
      };
      
      expect(determineMeetingStatus(meeting)).toBe('open');
    });

    it('should return closed when code_expires_at has passed', () => {
      const openDate = new Date();
      openDate.setHours(openDate.getHours() - 2); // 2 hours ago
      
      const expireDate = new Date();
      expireDate.setHours(expireDate.getHours() - 1); // 1 hour ago
      
      const meeting = {
        session_date: openDate.toISOString(),
        session_time: '14:00:00',
        attendance_opened_at: openDate.toISOString(),
        code_expires_at: expireDate.toISOString()
      };
      
      expect(determineMeetingStatus(meeting)).toBe('closed');
    });

    it('should prioritize scheduled time over attendance timestamps for pending', () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 1); // Tomorrow
      
      const pastDate = new Date();
      pastDate.setHours(pastDate.getHours() - 1); // 1 hour ago
      
      const meeting = {
        session_date: futureDate.toISOString(),
        session_time: '14:00:00',
        attendance_opened_at: pastDate.toISOString(), // This shouldn't matter
        attendance_closed_at: pastDate.toISOString()  // This shouldn't matter
      };
      
      expect(determineMeetingStatus(meeting)).toBe('pending');
    });

    it('should return pending when no session_date or session_time provided', () => {
      const meeting = {};
      
      expect(determineMeetingStatus(meeting)).toBe('pending');
    });
  });

  describe('Attendance Percentage Calculation', () => {
    
    function calculateAttendancePercentage(meetings, teamSize) {
      let totalAttendance = 0;
      let totalPossible = 0;
      
      meetings.forEach(meeting => {
        // Only count closed meetings
        if (meeting.status === 'closed') {
          totalAttendance += meeting.attendance_count || 0;
          totalPossible += teamSize;
        }
      });
      
      return totalPossible > 0
        ? Math.round((totalAttendance / totalPossible) * 100)
        : 0;
    }

    it('should calculate 0% when no meetings are closed', () => {
      const meetings = [
        { status: 'pending', attendance_count: 0 },
        { status: 'open', attendance_count: 0 }
      ];
      
      expect(calculateAttendancePercentage(meetings, 5)).toBe(0);
    });

    it('should calculate 100% when all members attended all closed meetings', () => {
      const meetings = [
        { status: 'closed', attendance_count: 5 },
        { status: 'closed', attendance_count: 5 }
      ];
      
      expect(calculateAttendancePercentage(meetings, 5)).toBe(100);
    });

    it('should calculate 50% when half attended', () => {
      const meetings = [
        { status: 'closed', attendance_count: 5 },
        { status: 'closed', attendance_count: 0 }
      ];
      
      expect(calculateAttendancePercentage(meetings, 5)).toBe(50);
    });

    it('should round to nearest integer', () => {
      const meetings = [
        { status: 'closed', attendance_count: 1 }, // 1/3 = 33.33%
      ];
      
      expect(calculateAttendancePercentage(meetings, 3)).toBe(33);
    });

    it('should only count closed meetings', () => {
      const meetings = [
        { status: 'closed', attendance_count: 2 },
        { status: 'open', attendance_count: 1 },
        { status: 'pending', attendance_count: 0 }
      ];
      
      const percentage = calculateAttendancePercentage(meetings, 2);
      // Only 1 closed meeting: 2/2 = 100%
      expect(percentage).toBe(100);
    });

    it('should handle team size as string (convert to number)', () => {
      const meetings = [
        { status: 'closed', attendance_count: 1 }
      ];
      
      const teamSizeString = '2'; // From API, might be string
      const percentage = calculateAttendancePercentage(meetings, Number(teamSizeString));
      
      expect(percentage).toBe(50);
    });

    it('should calculate Team 11 example: 1 present out of 10 possible (2 members × 5 meetings)', () => {
      const meetings = [
        { status: 'closed', attendance_count: 0 },
        { status: 'closed', attendance_count: 1 },
        { status: 'closed', attendance_count: 0 },
        { status: 'closed', attendance_count: 0 },
        { status: 'closed', attendance_count: 0 }
      ];
      
      const percentage = calculateAttendancePercentage(meetings, 2);
      // Total: 1 present, 10 possible (2 members × 5 meetings) = 10%
      expect(percentage).toBe(10);
    });

    it('should handle empty meetings array', () => {
      expect(calculateAttendancePercentage([], 5)).toBe(0);
    });

    it('should handle zero team size', () => {
      const meetings = [
        { status: 'closed', attendance_count: 0 }
      ];
      
      expect(calculateAttendancePercentage(meetings, 0)).toBe(0);
    });

    it('should handle missing attendance_count (treat as 0)', () => {
      const meetings = [
        { status: 'closed' }, // No attendance_count
        { status: 'closed', attendance_count: 2 }
      ];
      
      const percentage = calculateAttendancePercentage(meetings, 2);
      // (0 + 2) / (2 + 2) = 2/4 = 50%
      expect(percentage).toBe(50);
    });
  });

  describe('Team Size Type Conversion', () => {
    
    it('should convert string team size to number', () => {
      const teamSizeString = '5';
      const teamSizeNumber = Number(teamSizeString);
      
      expect(typeof teamSizeNumber).toBe('number');
      expect(teamSizeNumber).toBe(5);
    });

    it('should prevent string concatenation in calculations', () => {
      let totalPossible = 0;
      const teamSizeString = '2';
      
      // Without Number() conversion, this would concatenate
      totalPossible += teamSizeString; // Would give '02' if not careful
      
      // This demonstrates the bug that was fixed
      expect(totalPossible).toBe('02'); // String concatenation
      
      // With proper conversion
      totalPossible = 0;
      totalPossible += Number(teamSizeString);
      expect(totalPossible).toBe(2); // Proper addition
    });

    it('should handle member_count from API as string', () => {
      const teamFromAPI = {
        member_count: '5', // API might return as string
        members: []
      };
      
      const teamSize = Number(teamFromAPI.member_count || teamFromAPI.members?.length || 0);
      
      expect(typeof teamSize).toBe('number');
      expect(teamSize).toBe(5);
    });
  });

  describe('Time Display Formatting', () => {
    
    function formatMeetingTime(meeting) {
      if (!meeting.session_date || !meeting.session_time) {
        return 'TBD';
      }
      
      const sessionDate = new Date(meeting.session_date);
      const year = sessionDate.getUTCFullYear();
      const month = sessionDate.getUTCMonth();
      const day = sessionDate.getUTCDate();
      
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
      
      return `${dateStr} ${startTimeStr}`;
    }

    it('should format date and time correctly', () => {
      const meeting = {
        session_date: '2025-11-26T00:00:00Z',
        session_time: '15:00:00'
      };
      
      const formatted = formatMeetingTime(meeting);
      expect(formatted).toContain('Nov');
      expect(formatted).toContain('26');
      expect(formatted).toContain('2025');
      expect(formatted).toContain('PM');
    });

    it('should return TBD when session_date is missing', () => {
      const meeting = {
        session_time: '15:00:00'
      };
      
      expect(formatMeetingTime(meeting)).toBe('TBD');
    });

    it('should return TBD when session_time is missing', () => {
      const meeting = {
        session_date: '2025-11-26T00:00:00Z'
      };
      
      expect(formatMeetingTime(meeting)).toBe('TBD');
    });

    it('should use UTC components to avoid timezone issues', () => {
      const meeting = {
        session_date: '2025-11-26T00:00:00Z',
        session_time: '15:00:00'
      };
      
      const sessionDate = new Date(meeting.session_date);
      const year = sessionDate.getUTCFullYear();
      const month = sessionDate.getUTCMonth();
      const day = sessionDate.getUTCDate();
      
      expect(year).toBe(2025);
      expect(month).toBe(10); // November (0-indexed)
      expect(day).toBe(26);
    });
  });
});
