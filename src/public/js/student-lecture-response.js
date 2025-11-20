(function studentResponseForm() {
  const shell = document.querySelector('.student-response-shell');
  if (!shell || !window.LectureService) return;

  const selectors = {
    title: document.getElementById('student-lecture-title'),
    time: document.getElementById('student-lecture-time'),
    status: document.getElementById('student-lecture-status'),
    form: document.getElementById('student-response-form'),
    questionList: document.getElementById('student-question-list'),
    cancel: document.getElementById('student-cancel'),
    successPanel: document.getElementById('student-success'),
    successClose: document.getElementById('success-close'),
    updateAnswers: document.getElementById('update-answers')
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
      // Parse ISO strings - they may be in UTC, but we'll display in local time
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
    if (selectors.questionList) {
      selectors.questionList.innerHTML = '<p style="text-align: center; padding: 2rem; color: var(--gray-600);">Loading lecture...</p>';
    }
    // Ensure form is visible during loading
    if (selectors.form) {
      selectors.form.hidden = false;
      selectors.form.style.display = 'flex';
    }
    if (selectors.successPanel) {
      selectors.successPanel.hidden = true;
      selectors.successPanel.style.display = 'none';
    }
  }

  async function renderHeader() {
    if (!lecture) return;

    if (selectors.title) {
      selectors.title.textContent = lecture.label || lecture.title || 'Lecture';
    }
    if (selectors.time) {
    selectors.time.textContent = formatTimeRange(lecture.startsAt, lecture.endsAt);
    }
    if (selectors.status) {
      if (lecture.status === 'open') {
        selectors.status.textContent = 'Open';
      } else if (lecture.status === 'pending') {
        selectors.status.textContent = 'Not Opened';
      } else {
        selectors.status.textContent = 'Closed';
      }
    }
    
    console.log('Render header - status:', lecture.status);
    console.log('Render header - has questions:', lecture.questions?.length || 0);
    
    // Determine if session is open - check both status and attendance_opened_at
    const isOpen = lecture.status === 'open' || 
                   (lecture.attendance_opened_at && !lecture.attendance_closed_at);
    
    if (!isOpen) {
      // Session is closed - show success message and hide form
      console.log('Session is closed - hiding form');
      if (selectors.form) selectors.form.hidden = true;
      if (selectors.successPanel) {
      selectors.successPanel.hidden = false;
        const messageP = selectors.successPanel.querySelector('p');
        if (messageP) {
          messageP.textContent = 'This lecture is closed. Responses can no longer be submitted.';
        }
      }
    } else {
      // Session is open - show the form initially (students can submit/update responses)
      console.log('Session is open - showing form');
      if (selectors.form) {
        selectors.form.hidden = false;
        selectors.form.style.display = 'flex';
      }
      if (selectors.successPanel) {
        selectors.successPanel.hidden = true;
        selectors.successPanel.style.display = 'none';
      }
    }
  }

  function buildTextQuestion(question) {
    const textarea = document.createElement('textarea');
    textarea.id = `question-${question.id}`;
    textarea.name = `question-${question.id}`;
    textarea.placeholder = 'Enter response';
    textarea.required = question.is_required !== false;
    return textarea;
  }

  function buildOptionQuestion(question) {
    const group = document.createElement('div');
    group.className = 'option-group';
    const values = (question.options && question.options.length) ? question.options : ['Option 1', 'Option 2'];
    values.forEach((option) => {
      const label = document.createElement('label');
      label.className = 'option-chip';
      const input = document.createElement('input');
      input.type = 'radio';
      input.name = `question-${question.id}`;
      input.value = option;
      input.required = question.is_required !== false;
      input.addEventListener('change', () => {
        group.querySelectorAll('.option-chip').forEach((chip) => chip.classList.remove('selected'));
        label.classList.add('selected');
      });

      const span = document.createElement('span');
      span.textContent = option;

      label.append(input, span);
      group.appendChild(label);
    });
    return group;
  }

  function renderQuestions() {
    console.log('renderQuestions called');
    console.log('selectors.questionList:', selectors.questionList);
    console.log('lecture:', lecture);
    console.log('lecture.questions:', lecture?.questions);
    
    if (!selectors.questionList) {
      console.error('questionList selector not found');
      return;
    }
    
    if (!lecture) {
      console.error('lecture not found');
      selectors.questionList.innerHTML = '<p style="text-align: center; padding: 2rem; color: var(--red-600);">Error: Lecture data not loaded.</p>';
      return;
    }
    
    if (!lecture.questions || lecture.questions.length === 0) {
      console.warn('No questions found for lecture');
      selectors.questionList.innerHTML = '<p style="text-align: center; padding: 2rem; color: var(--gray-600);">No questions available for this lecture.</p>';
      return;
    }
    
    selectors.questionList.innerHTML = '';
    
    console.log(`Rendering ${lecture.questions.length} questions`);
    
    lecture.questions.forEach((question, index) => {
      console.log(`Rendering question ${index + 1}:`, question);
      const card = document.createElement('article');
      card.className = 'student-question-card';
      const heading = document.createElement('h3');
      heading.textContent = `${index + 1}. ${question.prompt || question.question_text}`;
      card.appendChild(heading);

      // Determine field type - text questions use textarea, others use radio buttons
      const isTextQuestion = question.type === 'text' || 
                             question.question_type === 'text';
      const field = isTextQuestion
        ? buildTextQuestion(question)
        : buildOptionQuestion(question);
      card.appendChild(field);
      selectors.questionList.appendChild(card);
    });
    
    console.log('Questions rendered successfully');
  }

  function collectAnswers() {
    if (!lecture || !lecture.questions) return [];
    
    return lecture.questions.map((question) => {
      const fieldName = `question-${question.id}`;
      let responseValue = '';
      if (question.type === 'text' || question.question_type === 'text') {
        responseValue = selectors.form.elements[fieldName]?.value.trim();
      } else {
        const checked = selectors.form.querySelector(`input[name="${fieldName}"]:checked`);
        responseValue = checked?.value;
      }
      return { 
        questionId: question.id, 
        response: responseValue,
        response_text: responseValue,
        response_option: question.type !== 'text' && question.question_type !== 'text' ? responseValue : null
      };
    });
  }

  function validateAnswers(answers) {
    if (!answers || answers.length === 0) {
      alert('No questions found.');
      return false;
    }
    
    const invalidAnswers = answers.filter((answer) => !answer.response || answer.response.trim().length === 0);
    if (invalidAnswers.length > 0) {
      alert('Please respond to every question before submitting.');
      return false;
    }
    return true;
  }

  function showSuccess() {
    // Hide form completely - make it not visible
    if (selectors.form) {
      selectors.form.hidden = true;
      selectors.form.style.display = 'none';
    }
    
    // Show success message
    if (selectors.successPanel) {
      selectors.successPanel.hidden = false;
      selectors.successPanel.style.display = 'flex';
      // Ensure the message text is correct
      const messageP = selectors.successPanel.querySelector('p');
      if (messageP) {
        messageP.textContent = 'Your attendance has been marked present for this lecture. You can update answers any time while the session is open.';
      }
    }
  }

  function showForm() {
    // Hide success panel
    if (selectors.successPanel) {
      selectors.successPanel.hidden = true;
      selectors.successPanel.style.display = 'none';
    }
    
    // Show form (allow updates)
    if (selectors.form) {
      selectors.form.hidden = false;
      selectors.form.style.display = 'flex';
      // Reload existing responses when showing form for updates
      loadExistingResponses();
    }
  }

  async function handleSubmit(event) {
    event.preventDefault();
    
    if (isLoading) return;

    const answers = collectAnswers();
    if (!validateAnswers(answers)) return;

    isLoading = true;
    const submitBtn = selectors.form.querySelector('button[type="submit"]');
    const originalText = submitBtn?.textContent;
    
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = 'Submitting...';
    }

    try {
      await window.LectureService.recordStudentResponses({
        lectureId: sessionId,
        sessionId: sessionId,
      answers
    });

      showSuccess();
    } catch (error) {
      console.error('Error submitting responses:', error);
      alert(`Error submitting responses: ${error.message}`);
    } finally {
      isLoading = false;
      if (submitBtn) {
        submitBtn.disabled = false;
        if (originalText) submitBtn.textContent = originalText;
      }
    }
  }

  function resetForm() {
    // Reset all text inputs
    if (selectors.form) {
    selectors.form.querySelectorAll('textarea').forEach((textarea) => {
      textarea.value = '';
    });
    
    // Reset all radio buttons
    selectors.form.querySelectorAll('input[type="radio"]').forEach((radio) => {
      radio.checked = false;
      radio.closest('.option-chip')?.classList.remove('selected');
    });
    }
  }

  function initActions() {
    if (selectors.cancel) {
    selectors.cancel.addEventListener('click', () => {
      resetForm();
    });
    }
    
    if (selectors.successClose) {
    selectors.successClose.addEventListener('click', () => {
      window.location.href = '/dashboard';
    });
    }
    
    if (selectors.updateAnswers) {
    selectors.updateAnswers.addEventListener('click', () => {
      showForm();
    });
    }
  }

  async function hydrate() {
    sessionId = getSessionId();
    
    if (!sessionId) {
      // Try to get from URL if coming from check-in
      const urlParams = new URLSearchParams(window.location.search);
      sessionId = urlParams.get('sessionId') || urlParams.get('lectureId');
      
      if (!sessionId) {
        alert('Error: No session ID provided. Please access this page from the lecture attendance page.');
        window.location.href = '/lecture-attendance-student';
        return;
      }
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

      console.log('Loaded lecture:', lecture);
      console.log('Questions count:', lecture.questions?.length || 0);
      console.log('Questions:', lecture.questions);

      await renderHeader();
      renderQuestions();
      
      // Check if questions were rendered
      if (lecture.questions && lecture.questions.length === 0) {
        console.warn('No questions found for this lecture');
        if (selectors.questionList) {
          selectors.questionList.innerHTML = '<p style="text-align: center; padding: 2rem; color: var(--gray-600);">No questions available for this lecture.</p>';
        }
      }
      
      // Load existing responses if any
      await loadExistingResponses();
    } catch (error) {
      console.error('Error hydrating response form:', error);
      alert(`Error loading lecture: ${error.message}`);
      if (selectors.questionList) {
        selectors.questionList.innerHTML = `<p style="color: var(--red-600); text-align: center; padding: 2rem;">Error loading lecture: ${error.message}</p>`;
      }
    }
  }

  async function loadExistingResponses() {
    if (!sessionId || !selectors.form) return;
    
    try {
      // Fetch existing responses directly from API
      const response = await fetch(`/api/sessions/${sessionId}/my-responses`, {
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' }
      });
      
      if (!response.ok) {
        return; // No responses or error
      }
      
      const responses = await response.json();
      if (!Array.isArray(responses) || responses.length === 0) {
        return; // No existing responses
      }
      
      // Populate form with existing responses
      responses.forEach(response => {
        const questionId = response.question_id || response.questionId;
        if (!questionId) return;
        
        const fieldName = `question-${questionId}`;
        const field = selectors.form.elements[fieldName];
        
        if (!field) return;
        
        if (field.tagName === 'TEXTAREA') {
          // Text response
          const value = response.response_text || response.response || '';
          field.value = value;
        } else if (field.tagName === 'INPUT' && field.type === 'radio') {
          // Option response
          const value = response.response_option || response.response || '';
          const radio = selectors.form.querySelector(`input[name="${fieldName}"][value="${value}"]`);
          if (radio) {
            radio.checked = true;
            radio.dispatchEvent(new Event('change'));
          }
        }
      });
    } catch (error) {
      console.error('Error loading existing responses:', error);
      // Don't show error - just continue without pre-filling
    }
  }

  function init() {
    hydrate();
    if (selectors.form) {
    selectors.form.addEventListener('submit', handleSubmit);
    }
    initActions();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
