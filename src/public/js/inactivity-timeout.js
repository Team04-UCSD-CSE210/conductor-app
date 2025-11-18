/**
 * Inactivity Timeout Manager
 * 
 * Tracks user inactivity and:
 * - Shows warning after 3 minutes of inactivity with 120 second countdown
 * - Automatically logs out after 5 minutes total of inactivity
 */

(function inactivityTimeout() {
  'use strict';

  // Configuration
  const WARNING_TIME_MS = 3 * 60 * 1000; // 3 minutes in milliseconds
  const COUNTDOWN_TIME_MS = 2 * 60 * 1000; // 2 minutes (120 seconds) in milliseconds
  const TOTAL_TIMEOUT_MS = WARNING_TIME_MS + COUNTDOWN_TIME_MS; // 5 minutes total

  let lastActivityTime = Date.now();
  let warningTimeout = null;
  let logoutTimeout = null;
  let countdownInterval = null;
  let warningModal = null;
  let countdownDisplay = null;
  let isWarningShown = false;

  /**
   * Reset all timers
   */
  function resetTimers() {
    // Clear existing timeouts
    if (warningTimeout) {
      clearTimeout(warningTimeout);
      warningTimeout = null;
    }
    if (logoutTimeout) {
      clearTimeout(logoutTimeout);
      logoutTimeout = null;
    }
    if (countdownInterval) {
      clearInterval(countdownInterval);
      countdownInterval = null;
    }

    // Hide warning modal if shown
    if (isWarningShown) {
      hideWarning();
    }

    // Update last activity time
    lastActivityTime = Date.now();

    // Set warning timeout (3 minutes)
    warningTimeout = setTimeout(() => {
      showWarning();
      // Set logout timeout (2 minutes after warning = 5 minutes total)
      logoutTimeout = setTimeout(() => {
        performLogout();
      }, COUNTDOWN_TIME_MS);

      // Start countdown
      startCountdown();
    }, WARNING_TIME_MS);
  }

  /**
   * Show warning modal with countdown
   */
  function showWarning() {
    isWarningShown = true;

    // Create modal if it doesn't exist
    if (!warningModal) {
      warningModal = document.createElement('div');
      warningModal.id = 'inactivity-warning-modal';
      warningModal.className = 'inactivity-warning-modal';
      warningModal.setAttribute('role', 'dialog');
      warningModal.setAttribute('aria-labelledby', 'inactivity-warning-title');
      warningModal.setAttribute('aria-modal', 'true');

      warningModal.innerHTML = `
        <div class="inactivity-warning-content">
          <div class="inactivity-warning-icon">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2"/>
              <path d="M12 8V12M12 16H12.01" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
            </svg>
          </div>
          <h2 id="inactivity-warning-title" class="inactivity-warning-title">Session Timeout Warning</h2>
          <p class="inactivity-warning-message">
            You have been inactive for 3 minutes. You will be automatically logged out in
            <strong id="inactivity-countdown" class="inactivity-countdown">120</strong> seconds
            if you don't interact with the page.
          </p>
          <div class="inactivity-warning-actions">
            <button id="inactivity-stay-active" class="btn-primary" type="button">
              Stay Active
            </button>
          </div>
        </div>
      `;

      document.body.appendChild(warningModal);

      countdownDisplay = document.getElementById('inactivity-countdown');
      const stayActiveBtn = document.getElementById('inactivity-stay-active');
      
      stayActiveBtn.addEventListener('click', () => {
        resetTimers();
      });

      // Prevent clicks on modal from resetting timer
      warningModal.addEventListener('click', (e) => {
        e.stopPropagation();
      });
    }

    // Show modal
    warningModal.classList.add('active');
    document.body.style.overflow = 'hidden';
  }

  /**
   * Hide warning modal
   */
  function hideWarning() {
    if (warningModal) {
      warningModal.classList.remove('active');
      document.body.style.overflow = '';
    }
    isWarningShown = false;
  }

  /**
   * Start countdown display
   */
  function startCountdown() {
    let remainingSeconds = Math.floor(COUNTDOWN_TIME_MS / 1000);

    if (!countdownDisplay) {
      countdownDisplay = document.getElementById('inactivity-countdown');
    }

    if (countdownDisplay) {
      countdownDisplay.textContent = remainingSeconds;
    }

    countdownInterval = setInterval(() => {
      remainingSeconds--;
      
      if (remainingSeconds <= 0) {
        clearInterval(countdownInterval);
        countdownInterval = null;
        if (countdownDisplay) {
          countdownDisplay.textContent = '0';
        }
      } else if (countdownDisplay) {
        countdownDisplay.textContent = remainingSeconds;
      }
    }, 1000);
  }

  /**
   * Perform logout by redirecting to logout endpoint
   */
  function performLogout() {
    // Clear all timers
    if (warningTimeout) clearTimeout(warningTimeout);
    if (logoutTimeout) clearTimeout(logoutTimeout);
    if (countdownInterval) clearInterval(countdownInterval);

    // Hide warning
    hideWarning();

    // Redirect to logout
    window.location.href = '/logout?reason=inactivity';
  }

  /**
   * Track user activity events
   */
  function trackActivity() {
    // Only reset if warning is not shown, or if user explicitly clicks "Stay Active"
    if (!isWarningShown) {
      resetTimers();
    }
  }

  // Events that indicate user activity
  const activityEvents = [
    'mousedown',
    'mousemove',
    'keypress',
    'scroll',
    'touchstart',
    'click'
  ];

  // Add event listeners for activity tracking
  activityEvents.forEach(event => {
    document.addEventListener(event, trackActivity, { passive: true });
  });

  // Initialize timers on page load
  resetTimers();

  // Also track visibility changes (tab switching)
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) {
      // User came back to the tab - reset timers
      resetTimers();
    }
  });

  // Expose reset function globally in case needed
  window.resetInactivityTimer = resetTimers;
})();

