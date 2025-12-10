(function instructorOverview() {
  const selectors = {
    container: document.querySelector('.overview-shell'),
    cards: document.getElementById('lecture-cards'),
    emptyState: document.getElementById('lectures-empty'),
    chart: document.getElementById('attendance-chart'),
    percent: document.getElementById('last-session-percent'),
    newLecture: document.getElementById('new-lecture-btn'),
    sidebar: document.querySelector('.sidebar')
  };

  let offeringId = null;
  let offeringInfo = null;
  let isLoading = false;

  function formatTimeRange(startIso, endIso) {
    if (!startIso || !endIso) return '—';
    try {
      // Parse ISO strings and ensure we're working with local time
    const start = new Date(startIso);
    const end = new Date(endIso);
      
      // Validate dates
      if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
        return '—';
      }
      
      // Always format in local timezone
      const dateFormatter = new Intl.DateTimeFormat('en-US', { 
        month: 'short', 
        day: 'numeric', 
        year: 'numeric',
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone
      });
      const timeFormatter = new Intl.DateTimeFormat('en-US', { 
        hour: 'numeric', 
        minute: 'numeric',
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone
      });
    return `${dateFormatter.format(start)} ${timeFormatter.format(start)}–${timeFormatter.format(end)}`;
    } catch (e) {
      console.warn('Error formatting time range:', e, startIso, endIso);
      return '—';
    }
  }

  function formatDateForChart(dateIso) {
    if (!dateIso) return '';
    try {
    const date = new Date(dateIso);
      if (Number.isNaN(date.getTime())) return '';
      // Always format in local timezone
      return new Intl.DateTimeFormat('en-US', { 
        month: 'short', 
        day: 'numeric',
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone
      }).format(date);
    } catch (e) {
      console.warn('Error formatting chart date:', e, dateIso);
      return '';
    }
  }

  function renderChart(history) {
    if (!selectors.chart) return;
    const chartDates = document.getElementById('chart-dates');
    
    selectors.chart.innerHTML = '';
    if (chartDates) chartDates.innerHTML = '';
    
    // Get palette colors for charts
    const paletteColors = globalThis.getPaletteColors ? globalThis.getPaletteColors() : {
      primary: '#0F766E',
      secondary: '#83D7CF'
    };
    
    // Show last 15 lectures with dates
    const displayHistory = history.slice(0, 15);
    
    displayHistory.forEach((entry) => {
      const barWrapper = document.createElement('div');
      barWrapper.className = 'bar-wrapper';
      
      const bar = document.createElement('div');
      bar.className = `bar ${entry.attendancePercent < 80 ? 'low' : ''}`;
      bar.style.height = `${Math.max(entry.attendancePercent, 8)}%`;
      bar.dataset.value = entry.attendancePercent;
      
      // Apply palette colors to chart bars
      if (entry.attendancePercent < 80) {
        // Low attendance - use warning colors (orange/yellow)
        bar.style.background = 'linear-gradient(180deg, #fcd34d 0%, #f97316 100%)';
      } else {
        // Normal attendance - use palette colors
        bar.style.background = `linear-gradient(180deg, ${paletteColors.secondary} 0%, ${paletteColors.primary} 100%)`;
      }
      
      // Add percentage label on top of bar
      const percentLabel = document.createElement('div');
      percentLabel.className = 'bar-percent';
      percentLabel.textContent = `${entry.attendancePercent}%`;
      
      barWrapper.appendChild(bar);
      barWrapper.appendChild(percentLabel);
      selectors.chart.appendChild(barWrapper);
      
      // Add date label below chart
      if (chartDates && entry.startsAt) {
        const dateLabel = document.createElement('div');
        dateLabel.className = 'date-label';
        dateLabel.textContent = formatDateForChart(entry.startsAt);
        chartDates.appendChild(dateLabel);
      }
    });
  }

  function createDeleteButton(lectureId, lectureLabel) {
    const button = document.createElement('button');
    button.className = 'delete-button';
    button.type = 'button';
    button.title = `Delete ${lectureLabel}`;
    button.setAttribute('aria-label', `Delete ${lectureLabel}`);
    button.innerHTML = `
      <svg width="18" height="18" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M2 4H14M12.6667 4V13.3333C12.6667 14 12 14.6667 11.3333 14.6667H4.66667C4 14.6667 3.33333 14 3.33333 13.3333V4M5.33333 4V2.66667C5.33333 2 6 1.33333 6.66667 1.33333H9.33333C10 1.33333 10.6667 2 10.6667 2.66667V4M6.66667 7.33333V11.3333M9.33333 7.33333V11.3333" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
    `;
    button.addEventListener('click', async (e) => {
      e.stopPropagation();
      if (window.confirm(`Are you sure you want to delete "${lectureLabel}"? This action cannot be undone.`)) {
        try {
          await window.LectureService.deleteLecture(lectureId);
          await hydrate();
        } catch (error) {
          alert(`Error deleting lecture: ${error.message}`);
        }
      }
    });
    return button;
  }

  function createPrimaryButton(lecture) {
    const button = document.createElement('button');
    button.className = 'btn-link';
    button.textContent = 'View Responses';
    button.addEventListener('click', () => {
      window.location.href = `/lecture-responses?sessionId=${lecture.id}`;
    });
    return button;
  }

  function createCopyCodeIcon(accessCode) {
    if (!accessCode) return null;
    
    const button = document.createElement('button');
    button.className = 'copy-code-icon';
    button.type = 'button';
    button.title = 'Copy access code';
    button.setAttribute('aria-label', 'Copy access code');
    button.innerHTML = `
      <svg width="14" height="14" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M5.5 4.5V2.5C5.5 1.94772 5.94772 1.5 6.5 1.5H11.5C12.0523 1.5 12.5 1.94772 12.5 2.5V7.5C12.5 8.05228 12.0523 8.5 11.5 8.5H9.5M5.5 4.5H4.5C3.94772 4.5 3.5 4.94772 3.5 5.5V13.5C3.5 14.0523 3.94772 14.5 4.5 14.5H9.5C10.0523 14.5 10.5 14.0523 10.5 13.5V12.5M5.5 4.5C5.5 4.94772 5.94772 5.5 6.5 5.5H9.5" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
    `;
    button.addEventListener('click', (e) => {
      e.stopPropagation();
      navigator.clipboard?.writeText(accessCode).catch(() => {});
      const originalHTML = button.innerHTML;
      button.innerHTML = `
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M13.5 4L6 11.5L2.5 8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      `;
      button.style.color = 'var(--emerald-600, #059669)';
      setTimeout(() => {
        button.innerHTML = originalHTML;
        button.style.color = '';
      }, 1500);
    });
    return button;
  }

  function buildLectureCard(lecture, currentLectureId) {
    const card = document.createElement('article');
    card.className = 'lecture-card';
    if (lecture.id === currentLectureId && lecture.status === 'open') {
      card.classList.add('active');
    }

    // Lecture label
    const labelWrapper = document.createElement('div');
    labelWrapper.className = 'lecture-label';
    const label = document.createElement('button');
    label.type = 'button';
    label.textContent = lecture.label;
    if (lecture.id === currentLectureId) label.classList.add('active');
    label.addEventListener('click', () => {
      // Allow navigation/editing for open and pending (not opened) lectures
      if (lecture.status === 'open' || lecture.status === 'pending') {
        // Navigate to form for editing
        window.location.href = `/lecture-builder?sessionId=${lecture.id}`;
      }
      // For closed lectures, do nothing
    });
    // Add visual indicator for non-clickable closed lectures
    if (lecture.status === 'closed') {
      label.style.cursor = 'default';
      label.style.opacity = '0.7';
    }
    labelWrapper.appendChild(label);

    // Attendance and date
    const meta = document.createElement('div');
    meta.className = 'lecture-meta';
    const attendance = document.createElement('span');
    attendance.className = 'attendance-percent';
    attendance.textContent = `${lecture.attendancePercent}% attendance`;
    const schedule = document.createElement('span');
    schedule.className = 'lecture-schedule';
    schedule.textContent = formatTimeRange(lecture.startsAt, lecture.endsAt);
    meta.append(attendance, schedule);

    // Access code column with copy button
    const accessCodeCol = document.createElement('div');
    accessCodeCol.className = 'access-code-col';
    const codeLabel = document.createElement('span');
    codeLabel.className = 'code-label';
    codeLabel.textContent = 'Access code:';
    const codeValueWrapper = document.createElement('div');
    codeValueWrapper.className = 'code-value-wrapper';
    const codeValue = document.createElement('span');
    codeValue.className = 'code-value';
    codeValue.textContent = lecture.accessCode || lecture.access_code || '—';
    const copyIcon = createCopyCodeIcon(lecture.accessCode || lecture.access_code);
    codeValueWrapper.append(codeValue);
    if (copyIcon) codeValueWrapper.append(copyIcon);
    accessCodeCol.append(codeLabel, codeValueWrapper);

    // Status column (Open/Closed/Not Opened with colors)
    const statusCol = document.createElement('div');
    statusCol.className = 'lecture-status';
    if (lecture.status === 'open') {
      statusCol.classList.add('open');
      statusCol.textContent = 'Open';
    } else if (lecture.status === 'pending') {
      statusCol.classList.add('pending');
      statusCol.textContent = 'Not Opened';
    } else {
      statusCol.classList.add('closed');
      statusCol.textContent = 'Closed';
    }

    // Actions column
    const actions = document.createElement('div');
    actions.className = 'lecture-actions';
    actions.append(createPrimaryButton(lecture));
    actions.append(createDeleteButton(lecture.id, lecture.label));

    card.append(labelWrapper, meta, accessCodeCol, statusCol, actions);
    return card;
  }

  function renderLectures(lectures, currentLectureId) {
    if (!selectors.cards) return;
    selectors.cards.innerHTML = '';

    if (!lectures.length) {
      selectors.emptyState?.removeAttribute('hidden');
      return;
    }
    selectors.emptyState?.setAttribute('hidden', 'true');

    lectures.forEach((lecture) => {
      selectors.cards.appendChild(buildLectureCard(lecture, currentLectureId));
    });
  }

  function updateNavigationLinks() {
    if (!offeringInfo || !selectors.sidebar) return;

    const courseCode = offeringInfo.code || 'cse210';
    const navLinks = selectors.sidebar.querySelectorAll('nav a');
    
    navLinks.forEach(link => {
      const href = link.getAttribute('href');
      if (href?.includes('/courses/cse210/')) {
        const newHref = href.replace('/courses/cse210/', `/courses/${courseCode.toLowerCase()}/`);
        link.setAttribute('href', newHref);
      }
    });
  }

  function showLoading() {
    if (selectors.cards) {
      selectors.cards.innerHTML = '<p style="text-align: center; padding: 2rem; color: var(--gray-600);">Loading lectures...</p>';
    }
    if (selectors.percent) {
      selectors.percent.textContent = '—';
    }
  }

  async function hydrate() {
    if (!window.LectureService || !selectors.container || isLoading) return;
    
    isLoading = true;
    showLoading();

    try {
      // Get offering ID and info from data attribute or fetch active offering
      offeringId = selectors.container.getAttribute('data-offering-id');
      
      if (!offeringId) {
        offeringId = await window.LectureService.getActiveOfferingId();
        if (!offeringId) {
          throw new Error('No active course offering found');
        }
        selectors.container.setAttribute('data-offering-id', offeringId);
      }

      // Parallelize API calls for better performance
      const [overviewResult, offeringResponse] = await Promise.all([
        window.LectureService.getInstructorOverview(offeringId),
        fetch(`/api/offerings/${offeringId}`, {
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' }
        }).catch(error => {
          console.error('Error fetching offering info:', error);
          return null; // Return null if fetch fails
        })
      ]);

      // Process offering info if available
      if (offeringResponse?.ok) {
        offeringInfo = await offeringResponse.json();
        updateNavigationLinks();
      }

      const { summaryPercent, history, lectures, currentLectureId } = overviewResult;
    
    const lastLecture = lectures?.length > 0 ? lectures[0] : null;
    const lastSessionPercent = lastLecture ? lastLecture.attendancePercent : summaryPercent;
    
    if (selectors.percent) selectors.percent.textContent = `${lastSessionPercent}%`;
    
    const historyWithDates = history.map((entry) => ({
        ...entry,
        date: entry.startsAt || null
      }));
    
    renderChart(historyWithDates);
    renderLectures(lectures, currentLectureId);
    } catch (error) {
      console.error('Error hydrating overview:', error);
      if (selectors.cards) {
        selectors.cards.innerHTML = `<p style="text-align: center; padding: 2rem; color: var(--red-600);">Error loading lectures: ${error.message}</p>`;
      }
      alert(`Error loading lectures: ${error.message}`);
    } finally {
      isLoading = false;
    }
  }

  function initNewLectureButton() {
    if (!selectors.newLecture) return;
    selectors.newLecture.addEventListener('click', () => {
      window.location.href = '/lecture-builder';
    });
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
  }

  function init() {
    initHamburger();
    initNewLectureButton();
    hydrate();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
