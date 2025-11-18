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

  const lectureId = shell.getAttribute('data-lecture-id');
  const lecture = window.LectureService.getLectureWithQuestions(lectureId);

  if (!lecture) {
    selectors.responseList.innerHTML = '<p>No lecture data available.</p>';
    return;
  }

  function formatTimeRange(startIso, endIso) {
    const start = new Date(startIso);
    const end = new Date(endIso);
    const dateFormatter = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    const timeFormatter = new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: 'numeric' });
    return `${dateFormatter.format(start)} · ${timeFormatter.format(start)}–${timeFormatter.format(end)}`;
  }

  function renderHeader() {
    if (selectors.title) selectors.title.textContent = lecture.label;
    if (selectors.time) selectors.time.textContent = formatTimeRange(lecture.startsAt, lecture.endsAt);
    if (selectors.attendance) selectors.attendance.textContent = `${lecture.attendancePercent}%`;
  }

  function renderQuestionOptions() {
    if (!selectors.questionSelect) return;
    selectors.questionSelect.innerHTML = '';
    if (!lecture.questions.length) {
      const option = document.createElement('option');
      option.textContent = 'No questions configured';
      option.disabled = true;
      option.selected = true;
      selectors.questionSelect.appendChild(option);
      selectors.questionSelect.disabled = true;
      selectors.responseList.innerHTML = '<p>No questions were created for this lecture.</p>';
      selectors.responseCount.textContent = '0 responses';
      return;
    }

    lecture.questions.forEach((question, index) => {
      const option = document.createElement('option');
      option.value = question.id;
      option.textContent = `${index + 1}. ${question.prompt}`;
      selectors.questionSelect.appendChild(option);
    });
  }

  function createResponseCard(response) {
    const card = document.createElement('article');
    card.className = 'response-card';

    const avatar = document.createElement('div');
    avatar.className = 'response-avatar';
    avatar.textContent = response.name
      .split(' ')
      .map((chunk) => chunk.charAt(0))
      .join('')
      .slice(0, 2);

    const body = document.createElement('div');
    body.className = 'response-body';

    const header = document.createElement('header');
    const title = document.createElement('h3');
    title.innerHTML = `${response.name} <span>${response.team}</span>`;
    header.appendChild(title);
    body.appendChild(header);

    const copy = document.createElement('p');
    copy.textContent = response.response;
    body.appendChild(copy);

    card.append(avatar, body);
    return card;
  }

  function renderResponses(questionId) {
    if (!selectors.responseList) return;
    const responses = window.LectureService.getQuestionResponses(lectureId, questionId);
    selectors.responseList.innerHTML = '';
    selectors.responseCount.textContent = `${responses.length} responses`;

    if (!responses.length) {
      const empty = document.createElement('p');
      empty.textContent = 'No responses recorded for this question yet.';
      selectors.responseList.appendChild(empty);
      return;
    }

    responses.forEach((response) => {
      selectors.responseList.appendChild(createResponseCard(response));
    });
  }

  function initQuestionSelect() {
    if (!selectors.questionSelect || selectors.questionSelect.disabled) return;
    selectors.questionSelect.addEventListener('change', (event) => {
      renderResponses(event.target.value);
    });
    if (selectors.questionSelect.value) {
      renderResponses(selectors.questionSelect.value);
    } else if (lecture.questions[0]) {
      selectors.questionSelect.value = lecture.questions[0].id;
      renderResponses(lecture.questions[0].id);
    }
  }

  function initBackButton() {
    if (!selectors.backButton) return;
    selectors.backButton.addEventListener('click', () => {
      window.location.href = '/courses/cse210/lectures';
    });
  }

  function init() {
    renderHeader();
    renderQuestionOptions();
    initQuestionSelect();
    initBackButton();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();

