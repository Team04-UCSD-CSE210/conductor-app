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
  let autoRefreshInterval = null;
  let currentQuestionId = null;
  const REFRESH_INTERVAL_MS = 5000; // Refresh every 5 seconds

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

    // Get question options (the pulse labels) - Use only 3 options
    const options = question.options || ['Confident', 'Neutral', 'Not Confident'];
    console.log('Pulse options:', options);
    
    // Only use 1st, 3rd, and 5th emoji (very_happy, neutral, angry)
    const emojis = ['very_happy.svg', 'neutral.svg', 'angry.svg'];
    const emojiColors = ['#86efac', '#fde047', '#ef4444']; // green, yellow, red
    
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
    
    const totalResponses = Object.values(counts).reduce((a, b) => a + b, 0);

    // Create horizontal segmented bar at top
    const topBar = document.createElement('div');
    topBar.style.display = 'flex';
    topBar.style.width = '100%';
    topBar.style.height = '60px';
    topBar.style.marginBottom = '30px';
    topBar.style.borderRadius = '30px';
    topBar.style.overflow = 'hidden';
    topBar.style.boxShadow = '0 2px 8px rgba(0,0,0,0.1)';

    options.forEach((option, index) => {
      const count = counts[option] || 0;
      const percentage = totalResponses > 0 ? (count / totalResponses) * 100 : 0;

      if (count > 0) {
        const segment = document.createElement('div');
        segment.style.width = `${percentage}%`;
        segment.style.backgroundColor = emojiColors[index];
        segment.style.display = 'flex';
        segment.style.alignItems = 'center';
        segment.style.justifyContent = 'center';
        segment.style.position = 'relative';
        segment.style.transition = 'all 0.3s ease';

        const emojiImg = document.createElement('img');
        emojiImg.src = `/assets/${emojis[index]}`;
        emojiImg.alt = option;
        emojiImg.style.width = '32px';
        emojiImg.style.height = '32px';

        segment.appendChild(emojiImg);
        topBar.appendChild(segment);
      }
    });

    container.appendChild(topBar);

    // Create response count labels below
    const labelsContainer = document.createElement('div');
    labelsContainer.style.display = 'flex';
    labelsContainer.style.justifyContent = 'space-around';
    labelsContainer.style.marginTop = '10px';

    options.forEach((option, index) => {
      const count = counts[option] || 0;

      if (count > 0) {
        const labelDiv = document.createElement('div');
        labelDiv.style.textAlign = 'center';
        labelDiv.style.flex = '1';

        const emojiImg = document.createElement('img');
        emojiImg.src = `/assets/${emojis[index]}`;
        emojiImg.alt = option;
        emojiImg.style.width = '24px';
        emojiImg.style.height = '24px';
        emojiImg.style.display = 'block';
        emojiImg.style.margin = '0 auto 5px';

        const countText = document.createElement('div');
        countText.textContent = `${count} response${count !== 1 ? 's' : ''}`;
        countText.style.fontSize = '14px';
        countText.style.color = '#6b7280';

        labelDiv.appendChild(emojiImg);
        labelDiv.appendChild(countText);
        labelsContainer.appendChild(labelDiv);
      }
    });

    container.appendChild(labelsContainer);

    return container;
  }

  function createMultipleChoiceBarGraph(responses, question) {
    console.log('createMultipleChoiceBarGraph called with:', { responses, question });
    
    const container = document.createElement('div');
    container.className = 'multiple-choice-results-container';

    // Get question options
    const options = question.options || [];
    console.log('Multiple choice options:', options);
    
    const colors = ['#60a5fa', '#a78bfa', '#f472b6', '#fb923c', '#34d399', '#fbbf24'];
    
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
    
    const totalResponses = Object.values(counts).reduce((a, b) => a + b, 0);

    // Helper function to truncate text
    function truncateText(text, maxLength = 20) {
      if (text.length <= maxLength) return text;
      return text.substring(0, maxLength - 3) + '...';
    }

    // Create horizontal segmented bar at top
    const topBar = document.createElement('div');
    topBar.style.display = 'flex';
    topBar.style.width = '100%';
    topBar.style.height = '60px';
    topBar.style.marginBottom = '30px';
    topBar.style.borderRadius = '30px';
    topBar.style.overflow = 'hidden';
    topBar.style.boxShadow = '0 2px 8px rgba(0,0,0,0.1)';

    options.forEach((option, index) => {
      const count = counts[option] || 0;
      const percentage = totalResponses > 0 ? (count / totalResponses) * 100 : 0;

      if (count > 0) {
        const segment = document.createElement('div');
        segment.style.width = `${percentage}%`;
        segment.style.backgroundColor = colors[index % colors.length];
        segment.style.display = 'flex';
        segment.style.alignItems = 'center';
        segment.style.justifyContent = 'center';
        segment.style.position = 'relative';
        segment.style.transition = 'all 0.3s ease';
        segment.style.padding = '0 8px';
        segment.style.overflow = 'hidden';

        const optionText = document.createElement('span');
        optionText.textContent = truncateText(option, 15);
        optionText.style.color = '#ffffff';
        optionText.style.fontSize = '13px';
        optionText.style.fontWeight = '600';
        optionText.style.textAlign = 'center';
        optionText.style.whiteSpace = 'nowrap';
        optionText.title = option; // Full text on hover

        segment.appendChild(optionText);
        topBar.appendChild(segment);
      }
    });

    container.appendChild(topBar);

    // Create response count labels below
    const labelsContainer = document.createElement('div');
    labelsContainer.style.display = 'flex';
    labelsContainer.style.justifyContent = 'space-around';
    labelsContainer.style.marginTop = '10px';
    labelsContainer.style.flexWrap = 'wrap';
    labelsContainer.style.gap = '15px';

    options.forEach((option) => {
      const count = counts[option] || 0;

      if (count > 0) {
        const labelDiv = document.createElement('div');
        labelDiv.style.textAlign = 'center';
        labelDiv.style.flex = '1';
        labelDiv.style.minWidth = '100px';

        const optionLabel = document.createElement('div');
        optionLabel.textContent = truncateText(option, 25);
        optionLabel.title = option; // Full text on hover
        optionLabel.style.fontSize = '13px';
        optionLabel.style.color = '#374151';
        optionLabel.style.fontWeight = '500';
        optionLabel.style.marginBottom = '5px';

        const countText = document.createElement('div');
        countText.textContent = `${count} response${count !== 1 ? 's' : ''}`;
        countText.style.fontSize = '14px';
        countText.style.color = '#6b7280';

        labelDiv.appendChild(optionLabel);
        labelDiv.appendChild(countText);
        labelsContainer.appendChild(labelDiv);
      }
    });

    container.appendChild(labelsContainer);

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
      } else if (questionType === 'multiple_choice') {
        console.log("Creating multiple choice graph!", responses);
        const mcqGraph = createMultipleChoiceBarGraph(responses, currentQuestion);
        selectors.responseList.appendChild(mcqGraph);
      } else {
        console.log('Text question, showing response cards');
        // For text questions, show response cards
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

  function startAutoRefresh(questionId) {
    // Clear any existing interval
    stopAutoRefresh();
    
    currentQuestionId = questionId;
    
    // Set up new interval for auto-refresh
    autoRefreshInterval = setInterval(() => {
      if (!isLoading && currentQuestionId) {
        console.log('Auto-refreshing responses...');
        renderResponses(currentQuestionId);
      }
    }, REFRESH_INTERVAL_MS);
    
    console.log('Auto-refresh started (every 5 seconds)');
  }

  function stopAutoRefresh() {
    if (autoRefreshInterval) {
      clearInterval(autoRefreshInterval);
      autoRefreshInterval = null;
      console.log('Auto-refresh stopped');
    }
  }

  function initQuestionSelect() {
    if (!selectors.questionSelect || selectors.questionSelect.disabled) return;
    
    selectors.questionSelect.addEventListener('change', (event) => {
      if (!isLoading) {
        const questionId = event.target.value;
        renderResponses(questionId);
        startAutoRefresh(questionId);
      }
    });
    
    // Load first question by default
    if (lecture && lecture.questions && lecture.questions.length > 0) {
      const firstQuestionId = lecture.questions[0].id;
      selectors.questionSelect.value = firstQuestionId;
      renderResponses(firstQuestionId);
      startAutoRefresh(firstQuestionId);
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
    
    // Stop auto-refresh when user leaves the page
    window.addEventListener('beforeunload', stopAutoRefresh);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
