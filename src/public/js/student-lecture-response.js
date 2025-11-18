(function studentResponseForm() {
  const shell = document.querySelector('.student-response-shell');
  if (!shell || !window.LectureService) return;

  const lectureId = shell.getAttribute('data-lecture-id');
  const studentId = shell.getAttribute('data-student-id');
  const lecture = window.LectureService.getLectureWithQuestions(lectureId);
  if (!lecture) return;

  const selectors = {
    title: document.getElementById('student-lecture-title'),
    time: document.getElementById('student-lecture-time'),
    status: document.getElementById('student-lecture-status'),
    form: document.getElementById('student-response-form'),
    questionList: document.getElementById('student-question-list'),
    cancel: document.getElementById('student-cancel'),
    successPanel: document.getElementById('student-success'),
    successClose: document.getElementById('success-close')
  };

  function formatTimeRange(startIso, endIso) {
    const start = new Date(startIso);
    const end = new Date(endIso);
    const dateFormatter = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    const timeFormatter = new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: 'numeric' });
    return `${dateFormatter.format(start)} · ${timeFormatter.format(start)}–${timeFormatter.format(end)}`;
  }

  function renderHeader() {
    selectors.title.textContent = lecture.label;
    selectors.time.textContent = formatTimeRange(lecture.startsAt, lecture.endsAt);
    selectors.status.textContent = lecture.status === 'open' ? 'Open' : 'Closed';
    
    // Check if student has already submitted responses (viewing responses mode)
    const hasSubmitted = window.LectureService.hasStudentSubmittedResponses(studentId, lectureId);
    
    if (lecture.status !== 'open') {
      // Session is closed - show success message
      selectors.form.hidden = true;
      selectors.successPanel.hidden = false;
      selectors.successPanel.querySelector('p').textContent = 'This lecture is closed. Responses can no longer be submitted.';
    } else if (hasSubmitted) {
      // Session is open but student has already submitted - show success message
      selectors.form.hidden = true;
      selectors.successPanel.hidden = false;
      selectors.successPanel.querySelector('p').textContent = 'Your attendance has been marked present for this lecture. You can update answers any time while the session is open.';
    } else {
      // First time submitting - show form, hide success message
      selectors.form.hidden = false;
      selectors.successPanel.hidden = true;
    }
  }

  function buildTextQuestion(question) {
    const textarea = document.createElement('textarea');
    textarea.id = `question-${question.id}`;
    textarea.name = `question-${question.id}`;
    textarea.placeholder = 'Enter response';
    textarea.required = true;
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
      input.required = true;
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
    selectors.questionList.innerHTML = '';
    lecture.questions.forEach((question, index) => {
      const card = document.createElement('article');
      card.className = 'student-question-card';
      const heading = document.createElement('h3');
      heading.textContent = `${index + 1}. ${question.prompt}`;
      card.appendChild(heading);

      const field = question.type === 'text'
        ? buildTextQuestion(question)
        : buildOptionQuestion(question);
      card.appendChild(field);
      selectors.questionList.appendChild(card);
    });
  }

  function collectAnswers() {
    return lecture.questions.map((question) => {
      const fieldName = `question-${question.id}`;
      let responseValue = '';
      if (question.type === 'text') {
        responseValue = selectors.form.elements[fieldName]?.value.trim();
      } else {
        const checked = selectors.form.querySelector(`input[name="${fieldName}"]:checked`);
        responseValue = checked?.value;
      }
      return { questionId: question.id, response: responseValue };
    });
  }

  function validateAnswers(answers) {
    if (answers.some((answer) => !answer.response)) {
      window.alert('Please respond to every question before submitting.');
      return false;
    }
    return true;
  }

  function showSuccess() {
    selectors.form.hidden = true;
    selectors.successPanel.hidden = false;
  }

  function handleSubmit(event) {
    event.preventDefault();
    const answers = collectAnswers();
    if (!validateAnswers(answers)) return;

    const result = window.LectureService.recordStudentResponses({
      studentId,
      lectureId,
      answers
    });

    if (result.success) {
      // Hide form and show success message
      selectors.form.hidden = true;
      selectors.successPanel.hidden = false;
    }
  }

  function resetForm() {
    // Reset all text inputs
    selectors.form.querySelectorAll('textarea').forEach((textarea) => {
      textarea.value = '';
    });
    
    // Reset all radio buttons
    selectors.form.querySelectorAll('input[type="radio"]').forEach((radio) => {
      radio.checked = false;
      radio.closest('.option-chip')?.classList.remove('selected');
    });
  }

  function initActions() {
    selectors.cancel.addEventListener('click', () => {
      resetForm();
    });
    selectors.successClose.addEventListener('click', () => {
      window.location.href = '/dashboard';
    });
  }

  function init() {
    renderHeader();
    renderQuestions();
    selectors.form.addEventListener('submit', handleSubmit);
    initActions();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();

