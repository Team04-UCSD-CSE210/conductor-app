(function lectureDetail() {
  const shell = document.querySelector('.responses-shell');
  if (!shell || !window.LectureService) return;

  const selectors = {
    title: document.getElementById('lecture-title'),
    time: document.getElementById('lecture-time'),
    attendance: document.getElementById('lecture-attendance'),
    questionSelect: document.getElementById('question-select'),
    responseList: document.getElementById('responses-list'),
    responseCount: document.getElementById('response-count'),
    backButton: document.getElementById('back-button')
  };

  let sessionId = null;
  let lecture = null;
  let isLoading = false;

  // Get session ID from URL params or data attribute
  function getSessionId() {
    // Try URL params first
    const urlParams = new URLSearchParams(window.location.search);
    sessionId = urlParams.get('sessionId') || urlParams.get('lectureId');
    
    // Fallback to data attribute
    if (!sessionId && shell) {
      sessionId = shell.getAttribute('data-session-id');
    }

    return sessionId;
  }

  function formatTimeRange(startIso, endIso) {
    if (!startIso || !endIso) return '—';
    try {
    const start = new Date(startIso);
    const end = new Date(endIso);
      
      // Validate dates
      if (isNaN(start.getTime()) || isNaN(end.getTime())) {
        return '—';
      }
      
    // Always format in local timezone (explicitly use local timezone)
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
    return `${dateFormatter.format(start)} · ${timeFormatter.format(start)}–${timeFormatter.format(end)}`;
    } catch (e) {
      console.warn('Error formatting time range:', e, startIso, endIso);
      return '—';
    }
  }

  function showLoading() {
    if (selectors.responseList) {
      selectors.responseList.innerHTML = '<p style="text-align: center; padding: 2rem; color: var(--gray-600);">Loading...</p>';
    }
  }

  async function renderHeader() {
    if (!lecture) return;

    if (selectors.title) selectors.title.textContent = lecture.label || lecture.title || 'Lecture';
    if (selectors.time) selectors.time.textContent = formatTimeRange(lecture.startsAt, lecture.endsAt);
    
    // Get attendance percentage from statistics
    if (selectors.attendance) {
      try {
        const stats = await window.LectureService.getSessionStatistics(sessionId);
        const attendancePercent = stats?.attendance_percent || lecture.attendancePercent || 0;
        selectors.attendance.textContent = `${Math.round(attendancePercent)}%`;
      } catch (error) {
        console.error('Error getting statistics:', error);
        selectors.attendance.textContent = `${lecture.attendancePercent || 0}%`;
  }
    }
  }

  async function renderQuestionOptions() {
    if (!selectors.questionSelect || !lecture) return;
    selectors.questionSelect.innerHTML = '';
    
    if (!lecture.questions || lecture.questions.length === 0) {
      const option = document.createElement('option');
      option.textContent = 'No questions configured';
      option.disabled = true;
      option.selected = true;
      selectors.questionSelect.appendChild(option);
      selectors.questionSelect.disabled = true;
      selectors.responseList.innerHTML = '<p>No questions were created for this lecture.</p>';
      if (selectors.responseCount) {
      selectors.responseCount.textContent = '0 responses';
      }
      return;
    }

    selectors.questionSelect.disabled = false;
    lecture.questions.forEach((question, index) => {
      const option = document.createElement('option');
      option.value = question.id;
      option.textContent = `${index + 1}. ${question.prompt || question.question_text}`;
      selectors.questionSelect.appendChild(option);
    });
  }

  function createResponseCard(response) {
    const card = document.createElement('article');
    card.className = 'response-card';

    const avatar = document.createElement('div');
    avatar.className = 'response-avatar';
    const nameParts = (response.name || 'Unknown').split(' ');
    avatar.textContent = nameParts
      .map((chunk) => chunk.charAt(0))
      .join('')
      .slice(0, 2)
      .toUpperCase();

    const body = document.createElement('div');
    body.className = 'response-body';

    const header = document.createElement('header');
    const title = document.createElement('h3');
    const teamSpan = document.createElement('span');
    teamSpan.textContent = response.team || 'No team';
    title.innerHTML = `${response.name || 'Unknown'} <span>${teamSpan.outerHTML}</span>`;
    header.appendChild(title);
    body.appendChild(header);

    const copy = document.createElement('p');
    copy.textContent = response.response || response.response_text || response.response_option || 'No response';
    body.appendChild(copy);

    card.append(avatar, body);
    return card;
  }

  function createPulseBarGraph(responses, question) {
    console.log('createPulseBarGraph called with:', { responses, question });
    
    const container = document.createElement('div');
    container.className = 'pulse-results-container';

    // Get question options (the pulse labels)
    const options = question.options || ['Strongly Agree', 'Agree', 'Neutral', 'Disagree', 'Strongly Disagree'];
    console.log('Pulse options:', options);
    
    const emojis = ['very_happy.svg', 'happy.svg', 'neutral.svg', 'sad.svg', 'angry.svg'];
    
    // Count responses for each option
    const counts = {};
    options.forEach(opt => counts[opt] = 0);
    
    responses.forEach(response => {
      const answer = response.response || response.response_text || response.response_option;
      console.log('Response answer:', answer);
      if (answer && counts[answer] !== undefined) {
        counts[answer]++;
      }
    });

    console.log('Counts:', counts);
    
    const totalResponses = responses.length;
    const maxCount = Math.max(...Object.values(counts), 1);

    // Create bar graph rows
    options.forEach((option, index) => {
      const count = counts[option] || 0;
      const percentage = totalResponses > 0 ? Math.round((count / totalResponses) * 100) : 0;
      const barWidth = maxCount > 0 ? Math.round((count / maxCount) * 100) : 0;

      const row = document.createElement('div');
      row.className = 'pulse-bar-row';

      // Emoji
      const emoji = document.createElement('div');
      emoji.className = 'pulse-bar-emoji';
      const img = document.createElement('img');
      img.src = `/assets/${emojis[index]}`;
      img.alt = '';
      img.setAttribute('aria-hidden', 'true');
      emoji.appendChild(img);

      // Label
      const label = document.createElement('div');
      label.className = 'pulse-bar-label';
      label.textContent = option;

      // Bar container
      const barContainer = document.createElement('div');
      barContainer.className = 'pulse-bar-container';
      
      const bar = document.createElement('div');
      bar.className = 'pulse-bar';
      bar.style.width = `${barWidth}%`;
      bar.setAttribute('data-count', count);
      
      barContainer.appendChild(bar);

      // Count display
      const countDisplay = document.createElement('div');
      countDisplay.className = 'pulse-bar-count';
      countDisplay.textContent = `${count} (${percentage}%)`;

      row.append(emoji, label, barContainer, countDisplay);
      container.appendChild(row);
    });

    return container;
  }

  async function renderResponses(questionId) {
    if (!selectors.responseList || !questionId) return;
    
    isLoading = true;
    showLoading();

    try {
      const responses = await window.LectureService.getQuestionResponses(sessionId, questionId);
      
    selectors.responseList.innerHTML = '';
      
      if (selectors.responseCount) {
        selectors.responseCount.textContent = `${responses.length} response${responses.length !== 1 ? 's' : ''}`;
      }

    if (!responses.length) {
      const empty = document.createElement('p');
      empty.textContent = 'No responses recorded for this question yet.';
        empty.style.textAlign = 'center';
        empty.style.padding = '2rem';
        empty.style.color = 'var(--gray-600)';
      selectors.responseList.appendChild(empty);
      return;
    }

      // Find the current question to check its type
      const currentQuestion = lecture.questions.find(q => q.id == questionId);
      console.log('Current question:', currentQuestion);
      console.log('Question ID:', questionId);
      console.log('All questions:', lecture.questions);
      
      const questionType = currentQuestion?.type || currentQuestion?.question_type;
      console.log('Question type:', questionType);

      // If it's a pulse question, show bar graph (check for both 'pulse' and 'pulse_check')
      if (questionType === 'pulse' || questionType === 'pulse_check') {
        console.log("Creating pulse graph!", responses);
        const pulseGraph = createPulseBarGraph(responses, currentQuestion);
        selectors.responseList.appendChild(pulseGraph);
      } else {
        console.log('Not a pulse question, showing response cards');
        // For text and mcq questions, show response cards
    responses.forEach((response) => {
      selectors.responseList.appendChild(createResponseCard(response));
    });
      }
    } catch (error) {
      console.error('Error rendering responses:', error);
      selectors.responseList.innerHTML = `<p style="color: var(--red-600); text-align: center; padding: 2rem;">Error loading responses: ${error.message}</p>`;
      if (selectors.responseCount) {
        selectors.responseCount.textContent = 'Error';
      }
    } finally {
      isLoading = false;
    }
  }

  function initQuestionSelect() {
    if (!selectors.questionSelect || selectors.questionSelect.disabled) return;
    
    selectors.questionSelect.addEventListener('change', (event) => {
      if (!isLoading) {
      renderResponses(event.target.value);
      }
    });
    
    // Load first question by default
    if (lecture && lecture.questions && lecture.questions.length > 0) {
      const firstQuestionId = lecture.questions[0].id;
      selectors.questionSelect.value = firstQuestionId;
      renderResponses(firstQuestionId);
    }
  }

  function initBackButton() {
    if (!selectors.backButton) return;
    selectors.backButton.addEventListener('click', () => {
      window.location.href = '/instructor-lectures';
    });
  }

  async function hydrate() {
    sessionId = getSessionId();
    
    if (!sessionId) {
      if (selectors.responseList) {
        selectors.responseList.innerHTML = '<p style="color: var(--red-600); text-align: center; padding: 2rem;">Error: No session ID provided. Please access this page from the lectures list.</p>';
      }
      return;
    }

    // Update data attribute
    if (shell) {
      shell.setAttribute('data-session-id', sessionId);
    }

    showLoading();

    try {
      lecture = await window.LectureService.getLectureWithQuestions(sessionId);
      
      if (!lecture) {
        throw new Error('Lecture not found');
      }

      await renderHeader();
      await renderQuestionOptions();
      initQuestionSelect();
    } catch (error) {
      console.error('Error hydrating lecture detail:', error);
      if (selectors.responseList) {
        selectors.responseList.innerHTML = `<p style="color: var(--red-600); text-align: center; padding: 2rem;">Error loading lecture: ${error.message}</p>`;
      }
    }
  }

  function init() {
    initBackButton();
    hydrate();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
