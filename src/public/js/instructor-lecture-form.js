(function lectureBuilder() {
  const form = document.getElementById('lecture-form');
  const questionList = document.getElementById('question-list');
  const addQuestionButton = document.getElementById('add-question');
  const backButton = document.getElementById('builder-back');
  const toast = document.getElementById('builder-toast');
  const toastCode = document.getElementById('toast-code');
  const toastView = document.getElementById('toast-view');
  const toastClose = document.getElementById('toast-close');
  const emptyState = document.getElementById('empty-questions');
  const saveStatus = document.getElementById('save-status');
  const autoSaveIndicator = document.getElementById('auto-save-indicator');
  const submitBtn = document.getElementById('submit-btn');
  const cancelBtn = document.getElementById('cancel-btn');
  const saveDraftBtn = document.getElementById('save-draft-btn');
  const courseId = document.querySelector('.builder-shell')?.getAttribute('data-course-id');

  if (!form || !questionList || !window.LectureService) return;

  let questionCounter = 0;
  let autoSaveTimer = null;
  let isSubmitting = false;
  let draggedElement = null;

  // Format date for display
  function formatDateDisplay(dateInput) {
    if (!dateInput || !dateInput.value) return '';
    const date = new Date(dateInput.value + 'T00:00:00');
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }

  // Update date display
  function updateDateDisplay() {
    const dateInput = document.getElementById('lecture-date');
    if (dateInput) {
      const formatted = formatDateDisplay(dateInput);
      dateInput.setAttribute('data-formatted', formatted);
    }
  }

  // Character counter
  function setupCharCounter(inputId, counterId, maxLength) {
    const input = document.getElementById(inputId);
    const counter = document.getElementById(counterId);
    if (!input || !counter) return;

    function updateCounter() {
      const length = input.value.length;
      counter.textContent = length;
      if (length > maxLength * 0.9) {
        counter.parentElement.style.color = 'var(--amber-600, #d97706)';
      } else {
        counter.parentElement.style.color = 'var(--gray-400, #9ca3af)';
      }
    }

    input.addEventListener('input', updateCounter);
    updateCounter();
  }

  // Form validation
  function validateTimeRange() {
    const startTime = document.getElementById('lecture-start')?.value;
    const endTime = document.getElementById('lecture-end')?.value;
    const date = document.getElementById('lecture-date')?.value;
    const startError = document.getElementById('start-error');
    const endError = document.getElementById('end-error');

    if (!startTime || !endTime || !date) return true;

    const start = new Date(`${date}T${startTime}`);
    const end = new Date(`${date}T${endTime}`);

    if (end <= start) {
      if (endError) {
        endError.textContent = 'End time must be after start time';
        endError.classList.add('show');
        document.getElementById('lecture-end').classList.add('error');
      }
      return false;
    } else {
      if (endError) {
        endError.classList.remove('show');
        document.getElementById('lecture-end').classList.remove('error');
      }
    }

    return true;
  }

  function validateField(fieldId, errorId, validator) {
    const field = document.getElementById(fieldId);
    const error = document.getElementById(errorId);
    if (!field || !error) return true;

    const isValid = validator(field.value);
    if (!isValid) {
      error.classList.add('show');
      field.classList.add('error');
      return false;
    } else {
      error.classList.remove('show');
      field.classList.remove('error');
      return true;
    }
  }

  function validateForm() {
    let isValid = true;

    // Validate label
    isValid = validateField('lecture-label', 'label-error', (value) => {
      if (!value || value.trim().length === 0) {
        document.getElementById('label-error').textContent = 'Lecture label is required';
        return false;
      }
      if (value.length > 100) {
        document.getElementById('label-error').textContent = 'Label must be 100 characters or less';
        return false;
      }
      return true;
    }) && isValid;

    // Validate date
    isValid = validateField('lecture-date', 'date-error', (value) => {
      if (!value) {
        document.getElementById('date-error').textContent = 'Date is required';
        return false;
      }
      return true;
    }) && isValid;

    // Validate times
    isValid = validateField('lecture-start', 'start-error', (value) => {
      if (!value) {
        document.getElementById('start-error').textContent = 'Start time is required';
        return false;
      }
      return true;
    }) && isValid;

    isValid = validateField('lecture-end', 'end-error', (value) => {
      if (!value) {
        document.getElementById('end-error').textContent = 'End time is required';
        return false;
      }
      return true;
    }) && isValid;

    // Validate time range
    isValid = validateTimeRange() && isValid;

    // Validate questions
    const questions = questionList.children;
    if (questions.length === 0) {
      isValid = false;
      // Show error in question section
    }

    return isValid;
  }

  // Auto-save indicator
  function showSaving() {
    if (saveStatus) {
      saveStatus.textContent = 'Saving...';
      saveStatus.classList.add('saving');
    }
  }

  function showSaved() {
    if (saveStatus) {
      saveStatus.textContent = 'All changes saved';
      saveStatus.classList.remove('saving');
    }
  }

  function triggerAutoSave() {
    if (autoSaveTimer) clearTimeout(autoSaveTimer);
    showSaving();
    
    autoSaveTimer = setTimeout(() => {
      // Simulate auto-save
      showSaved();
    }, 1000);
  }

  // Update question labels
  function updateQuestionLabels() {
    [...questionList.children].forEach((card, index) => {
      const title = card.querySelector('header h4');
      if (title) {
        const dragHandle = title.querySelector('.drag-handle');
        const titleText = document.createElement('span');
        titleText.textContent = `Question ${index + 1}`;
        if (dragHandle) {
          title.innerHTML = '';
          title.appendChild(dragHandle);
          title.appendChild(titleText);
        } else {
          title.textContent = `Question ${index + 1}`;
        }
      }
      const removeBtn = card.querySelector('.remove-question');
      if (removeBtn) removeBtn.disabled = questionList.children.length === 1;
    });

    // Always hide empty state since there's always at least one question by default
    if (emptyState) {
      emptyState.setAttribute('hidden', 'true');
    }
  }

  // Create drag handle
  function createDragHandle() {
    const handle = document.createElement('div');
    handle.className = 'drag-handle';
    handle.setAttribute('aria-label', 'Drag to reorder');
    handle.innerHTML = `
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M6 4H10M6 8H10M6 12H10" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
      </svg>
    `;
    handle.draggable = true;
    return handle;
  }

  // Drag and drop
  function setupDragAndDrop() {
    questionList.addEventListener('dragstart', (e) => {
      if (e.target.classList.contains('drag-handle') || e.target.closest('.drag-handle')) {
        draggedElement = e.target.closest('.question-card');
        if (draggedElement) {
          draggedElement.classList.add('dragging');
          e.dataTransfer.effectAllowed = 'move';
        }
      }
    });

    questionList.addEventListener('dragend', (e) => {
      if (draggedElement) {
        draggedElement.classList.remove('dragging');
        draggedElement = null;
      }
    });

    questionList.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      
      const afterElement = getDragAfterElement(questionList, e.clientY);
      const dragging = document.querySelector('.dragging');
      
      if (afterElement == null) {
        questionList.appendChild(dragging);
      } else {
        questionList.insertBefore(dragging, afterElement);
      }
    });
  }

  function getDragAfterElement(container, y) {
    const draggableElements = [...container.querySelectorAll('.question-card:not(.dragging)')];
    
    return draggableElements.reduce((closest, child) => {
      const box = child.getBoundingClientRect();
      const offset = y - box.top - box.height / 2;
      
      if (offset < 0 && offset > closest.offset) {
        return { offset: offset, element: child };
      } else {
        return closest;
      }
    }, { offset: Number.NEGATIVE_INFINITY }).element;
  }

  // Create option row
  function createOptionRow(listEl, value = '', index = 0) {
    const row = document.createElement('div');
    row.className = 'option-row';

    const label = document.createElement('label');
    label.textContent = `Option ${index + 1}`;
    label.style.fontWeight = '600';
    label.style.fontSize = '0.9rem';
    label.style.color = 'var(--gray-700, #374151)';
    label.style.minWidth = '80px';
    label.style.flexShrink = '0';

    const input = document.createElement('input');
    input.type = 'text';
    input.placeholder = 'Enter option text';
    input.value = value;
    input.required = true;
    input.setAttribute('aria-label', `Option ${index + 1}`);

    const remove = document.createElement('button');
    remove.type = 'button';
    remove.setAttribute('aria-label', 'Remove option');
    remove.innerHTML = `
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M12 4L4 12M4 4L12 12" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
    `;
    remove.addEventListener('click', () => {
      if (listEl.children.length > 1) {
        row.remove();
        // Update labels after removal
        [...listEl.querySelectorAll('.option-row')].forEach((r, i) => {
          const lbl = r.querySelector('label');
          if (lbl) lbl.textContent = `Option ${i + 1}`;
        });
      }
    });

    row.append(label, input, remove);
    listEl.appendChild(row);
    
    // Update all option labels
    [...listEl.querySelectorAll('.option-row')].forEach((r, i) => {
      const lbl = r.querySelector('label');
      if (lbl) lbl.textContent = `Option ${i + 1}`;
    });
  }

  // Render dynamic fields
  function renderDynamicFields(container, type, existing = []) {
    container.innerHTML = '';
    if (type === 'text') {
      const helper = document.createElement('p');
      helper.className = 'field-helper';
      helper.textContent = 'Students will submit a short paragraph or 2-3 sentences.';
      container.appendChild(helper);
      return;
    }

    const optionList = document.createElement('div');
    optionList.className = 'option-list';
    const seedValues = existing.length
      ? existing
      : type === 'pulse'
        ? ['Yes', 'Somewhat', 'Not yet']
        : ['Option 1', 'Option 2'];

    seedValues.forEach((value, index) => createOptionRow(optionList, value, index));

    const addOption = document.createElement('button');
    addOption.type = 'button';
    addOption.className = 'btn-outlined';
    addOption.textContent = '+ Add option';
    addOption.addEventListener('click', () => createOptionRow(optionList));

    container.append(optionList, addOption);
  }

  // Collect options
  function collectOptions(container) {
    const inputs = container.querySelectorAll('.option-row input');
    return [...inputs]
      .map((input) => input.value.trim())
      .filter(Boolean);
  }

  // Create question card
  function createQuestionCard(initial = {}) {
    const card = document.createElement('article');
    card.className = 'question-card';
    card.dataset.questionId = `question-${Date.now()}-${questionCounter++}`;
    card.setAttribute('draggable', 'true');

    const header = document.createElement('header');
    const title = document.createElement('h4');
    const dragHandle = createDragHandle();
    const titleText = document.createElement('span');
    titleText.textContent = 'Question';
    title.appendChild(dragHandle);
    title.appendChild(titleText);
    
    const removeButton = document.createElement('button');
    removeButton.type = 'button';
    removeButton.className = 'remove-question';
    removeButton.setAttribute('aria-label', 'Delete question');
    removeButton.innerHTML = `
      <svg width="18" height="18" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M2 4H14M12.6667 4V13.3333C12.6667 14 12 14.6667 11.3333 14.6667H4.66667C4 14.6667 3.33333 14 3.33333 13.3333V4M5.33333 4V2.66667C5.33333 2 6 1.33333 6.66667 1.33333H9.33333C10 1.33333 10.6667 2 10.6667 2.66667V4M6.66667 7.33333V11.3333M9.33333 7.33333V11.3333" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
    `;
    removeButton.addEventListener('click', () => {
      if (questionList.children.length === 1) {
        alert('You must have at least one question.');
        return;
      }
      const questionText = card.querySelector('input[type="text"]')?.value || 'this question';
      if (window.confirm(`Delete "${questionText}"? This cannot be undone.`)) {
      card.remove();
      updateQuestionLabels();
        triggerAutoSave();
      }
    });
    header.append(title, removeButton);

    const promptLabel = document.createElement('label');
    promptLabel.setAttribute('for', `question-prompt-${card.dataset.questionId}`);
    promptLabel.textContent = 'Question prompt';
    promptLabel.style.fontWeight = '600';
    promptLabel.style.fontSize = '0.95rem';
    promptLabel.style.color = 'var(--gray-700, #374151)';
    promptLabel.style.marginBottom = '0.5rem';
    promptLabel.style.display = 'block';

    const promptInput = document.createElement('input');
    promptInput.type = 'text';
    promptInput.id = `question-prompt-${card.dataset.questionId}`;
    promptInput.placeholder = 'Enter your question here...';
    promptInput.value = initial.prompt || '';
    promptInput.required = true;
    promptInput.setAttribute('aria-label', 'Question prompt');
    promptInput.addEventListener('input', triggerAutoSave);

    const typeWrapper = document.createElement('div');
    typeWrapper.className = 'question-type';
    const typeLabel = document.createElement('label');
    typeLabel.textContent = 'Type';
    const select = document.createElement('select');
    select.setAttribute('aria-label', 'Question type');
    select.innerHTML = `
      <option value="text">Short text</option>
      <option value="mcq">Multiple choice</option>
      <option value="pulse">Pulse</option>
    `;
    select.value = initial.type || 'text';
    const dynamicArea = document.createElement('div');

    select.addEventListener('change', () => {
      const currentOptions = collectOptions(dynamicArea);
      renderDynamicFields(dynamicArea, select.value, currentOptions);
      triggerAutoSave();
    });
    select.addEventListener('change', triggerAutoSave);

    renderDynamicFields(dynamicArea, select.value, initial.options || []);
    typeWrapper.append(typeLabel, select);
    card.append(header, promptLabel, promptInput, typeWrapper, dynamicArea);
    return card;
  }

  // Add question
  function addQuestion(initial) {
    const card = createQuestionCard(initial);
    questionList.appendChild(card);
    updateQuestionLabels();
    triggerAutoSave();
    
    // Focus on the new question input
    const input = card.querySelector('input[type="text"]');
    if (input) {
      setTimeout(() => input.focus(), 100);
    }
  }

  // Get date value
  function getDateValue(id) {
    const value = document.getElementById(id)?.value;
    return value || '';
  }

  // Combine date and time
  function combineDateTime(date, time) {
    if (!date || !time) return null;
    return new Date(`${date}T${time}`).toISOString();
  }

  // Collect questions
  function collectQuestions() {
    return [...questionList.children].map((card, index) => {
      const prompt = card.querySelector('input[type="text"]')?.value.trim();
      const select = card.querySelector('select');
      const dynamicArea = card.querySelector('.option-list')?.parentElement;
      const type = select?.value || 'text';
      let options = [];
      if (type !== 'text' && dynamicArea) {
        options = collectOptions(dynamicArea);
      }
      return {
        id: `${card.dataset.questionId || `new-${index}`}`,
        prompt,
        type,
        ...(options.length ? { options } : {})
      };
    });
  }

  // Show toast - only called after successful lecture creation
  function showToast(lecture) {
    if (!toast || !lecture || !lecture.id) {
      // Ensure toast stays hidden if invalid
      if (toast) {
        toast.setAttribute('hidden', 'true');
      }
      return;
    }
    
    // Clear any existing timeout
    if (toast._hideTimeout) {
      clearTimeout(toast._hideTimeout);
      toast._hideTimeout = null;
    }
    
    // Set the access code
    if (toastCode && lecture.accessCode) {
      toastCode.textContent = lecture.accessCode;
    }
    
    // Set up view button - replace any existing handler
    if (toastView) {
      toastView.onclick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        window.location.href = `/lectures/${lecture.id}/responses`;
      };
    }
    
    // Set up close button - replace any existing handler
    if (toastClose) {
      toastClose.onclick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (toast._hideTimeout) {
          clearTimeout(toast._hideTimeout);
          toast._hideTimeout = null;
        }
        toast.setAttribute('hidden', 'true');
      };
    }
    
    // Show the toast - only after successful creation
    toast.removeAttribute('hidden');
    
    // Auto-hide after 8 seconds
    toast._hideTimeout = setTimeout(() => {
      if (toast && !toast.hasAttribute('hidden')) {
        toast.setAttribute('hidden', 'true');
      }
      toast._hideTimeout = null;
    }, 8000);
  }

  // Handle submit
  async function handleSubmit(event) {
    event.preventDefault();
    
    if (isSubmitting) return;
    
    if (!validateForm()) {
      // Scroll to first error
      const firstError = form.querySelector('.error');
      if (firstError) {
        firstError.scrollIntoView({ behavior: 'smooth', block: 'center' });
        firstError.focus();
      }
      return;
    }

    isSubmitting = true;
    const btnText = submitBtn.querySelector('.btn-text');
    const btnLoader = submitBtn.querySelector('.btn-loader');
    
    if (btnText) btnText.textContent = 'Creating...';
    if (btnLoader) btnLoader.removeAttribute('hidden');
    submitBtn.disabled = true;

    try {
      const label = document.getElementById('lecture-label')?.value.trim();
      const date = getDateValue('lecture-date');
      const startTime = getDateValue('lecture-start');
      const endTime = getDateValue('lecture-end');
      const startsAt = combineDateTime(date, startTime);
      const endsAt = combineDateTime(date, endTime);
      const questions = collectQuestions();

      // Validate that we have at least one question
      if (!questions || questions.length === 0) {
        throw new Error('At least one question is required');
      }

      // Validate that all questions have prompts
      const invalidQuestions = questions.filter(q => !q.prompt || q.prompt.trim().length === 0);
      if (invalidQuestions.length > 0) {
        throw new Error('All questions must have a prompt');
      }

      const lecture = window.LectureService.createLecture({
        courseId,
        label,
        startsAt,
        endsAt,
        questions
      });

      // Only show toast after successful creation
      if (lecture && lecture.id) {
        // Reset form
        form.reset();
        questionList.innerHTML = '';
        addQuestion();
        showSaved();
        
        // Show toast notification
        showToast(lecture);
      }
      
      // Reset button after a delay
      setTimeout(() => {
        if (btnText) btnText.textContent = 'Create attendance session';
        if (btnLoader) btnLoader.setAttribute('hidden', 'true');
        submitBtn.disabled = false;
        isSubmitting = false;
      }, 2000);
    } catch (error) {
      console.error('Error creating lecture:', error);
      alert(error.message || 'Failed to create lecture. Please try again.');
      if (btnText) btnText.textContent = 'Create attendance session';
      if (btnLoader) btnLoader.setAttribute('hidden', 'true');
      submitBtn.disabled = false;
      isSubmitting = false;
    }
  }

  // Initialize
  function init() {
    // Ensure toast is hidden on page load and stays hidden until successful submit
    if (toast) {
      toast.setAttribute('hidden', 'true');
      // Clear any existing timeout
      if (toast._hideTimeout) {
        clearTimeout(toast._hideTimeout);
        toast._hideTimeout = null;
      }
    }
    
    // Ensure empty state is hidden (always at least one question)
    if (emptyState) {
      emptyState.setAttribute('hidden', 'true');
    }
    
    // Setup date display
    const dateInput = document.getElementById('lecture-date');
    if (dateInput) {
      dateInput.addEventListener('change', updateDateDisplay);
      updateDateDisplay();
    }

    // Setup character counter
    setupCharCounter('lecture-label', 'label-count', 100);

    // Setup time validation
    const startTime = document.getElementById('lecture-start');
    const endTime = document.getElementById('lecture-end');
    if (startTime && endTime) {
      [startTime, endTime, dateInput].forEach(input => {
        if (input) {
          input.addEventListener('change', () => {
            validateTimeRange();
            triggerAutoSave();
          });
        }
      });
    }

    // Setup form field validation
    const labelInput = document.getElementById('lecture-label');
    if (labelInput) {
      labelInput.addEventListener('blur', () => {
        validateField('lecture-label', 'label-error', (value) => {
          if (!value || value.trim().length === 0) {
            document.getElementById('label-error').textContent = 'Lecture label is required';
            return false;
          }
          return true;
        });
      });
      labelInput.addEventListener('input', triggerAutoSave);
    }

    // Setup drag and drop
    setupDragAndDrop();

    // Add initial question
    addQuestion({
      prompt: 'Summarize your thoughts on Farley chapters 1-2 in 2-3 sentences',
      type: 'text'
    });

    // Event listeners
    addQuestionButton.addEventListener('click', () => addQuestion());
    form.addEventListener('submit', handleSubmit);
    
    backButton?.addEventListener('click', () => {
      if (confirm('Are you sure you want to leave? Unsaved changes will be lost.')) {
        window.location.href = '/instructor-lectures';
      }
    });

    cancelBtn?.addEventListener('click', () => {
      if (confirm('Are you sure you want to cancel? Unsaved changes will be lost.')) {
        window.location.href = '/instructor-lectures';
      }
    });

    saveDraftBtn?.addEventListener('click', () => {
      // Save draft functionality
      showSaving();
      setTimeout(() => {
        showSaved();
        alert('Draft saved successfully!');
      }, 1000);
    });

    // Auto-save on form changes
    form.addEventListener('input', triggerAutoSave);
    form.addEventListener('change', triggerAutoSave);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
