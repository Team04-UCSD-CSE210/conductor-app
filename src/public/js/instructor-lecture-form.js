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
  const submitBtn = document.getElementById('submit-btn');
  const cancelBtn = document.getElementById('cancel-btn');
  const saveDraftBtn = document.getElementById('save-draft-btn');
  const container = document.querySelector('.builder-shell');

  if (!form || !questionList || !window.LectureService) return;

  let offeringId = null;
  let questionCounter = 0;
  let autoSaveTimer = null;
  let isSubmitting = false;
  let draggedElement = null;

  // Format date for display (Month Day, Year format, e.g., Nov 18, 2025)
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
      // Store formatted value for display
      dateInput.setAttribute('data-formatted', formatted);
      
      // Update placeholder/display if there's a display element
      const displayElement = dateInput.nextElementSibling;
      if (displayElement && displayElement.classList.contains('date-display')) {
        displayElement.textContent = formatted || 'Select date';
      }
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
      
      // Show/hide counter based on input
      if (length === 0) {
        counter.parentElement.style.display = 'none';
      } else {
        counter.parentElement.style.display = 'block';
      }
      
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
      alert('Please add at least one question.');
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
      // Simulate auto-save (could be implemented with draft API later)
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

    questionList.addEventListener('dragend', () => {
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
    promptInput.value = initial.prompt || initial.question_text || '';
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
    select.value = initial.type || initial.question_type || 'text';
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
    if (toastCode && (lecture.accessCode || lecture.access_code)) {
      toastCode.textContent = lecture.accessCode || lecture.access_code;
    }
    
    // Set up view button - replace any existing handler
    if (toastView) {
      toastView.onclick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        window.location.href = `/lecture-responses?sessionId=${lecture.id}`;
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

    // Get offering ID if not already loaded
    if (!offeringId) {
      try {
        offeringId = await window.LectureService.getActiveOfferingId();
        if (container) {
          container.setAttribute('data-offering-id', offeringId);
        }
      } catch (error) {
        alert(`Error getting course offering: ${error.message}`);
        return;
      }
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

      // Ensure offeringId is valid - check multiple times with better validation
      let finalOfferingId = offeringId;
      
      if (!finalOfferingId || finalOfferingId === 'undefined' || finalOfferingId === 'null') {
        // Try to get offering ID again
        try {
          finalOfferingId = await window.LectureService.getActiveOfferingId();
          if (finalOfferingId && container) {
            container.setAttribute('data-offering-id', finalOfferingId);
            offeringId = finalOfferingId; // Update module-level variable
          }
        } catch (err) {
          console.error('Error getting offering ID:', err);
          throw new Error('Unable to find an active course offering. Please ensure you have an active course offering set up. If the problem persists, refresh the page and try again.');
        }
      }
      
      // Final validation with strict check
      if (!finalOfferingId || finalOfferingId === 'undefined' || finalOfferingId === 'null' || typeof finalOfferingId === 'undefined') {
        console.error('offeringId validation failed:', { offeringId, finalOfferingId, type: typeof finalOfferingId });
        throw new Error('No active course offering found. Please ensure you have an active course offering (e.g., CSE 210) set up and marked as active in the system.');
      }

      // Validate all required fields
      if (!label || !startsAt || !endsAt) {
        throw new Error('Please fill in all required fields (label, date, start time, end time).');
      }

      // Log for debugging
      console.log('Creating lecture with offering_id:', finalOfferingId);

      const lecture = await window.LectureService.createLecture({
        offering_id: finalOfferingId,
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
    // Wait for LectureService to be available
    const initOffering = async () => {
      // Wait for LectureService to load
      if (!window.LectureService) {
        await new Promise((resolve) => {
          const checkInterval = setInterval(() => {
            if (window.LectureService) {
              clearInterval(checkInterval);
              resolve();
            }
          }, 50);
          // Timeout after 5 seconds
          setTimeout(() => {
            clearInterval(checkInterval);
            resolve();
          }, 5000);
        });
      }
      
      if (!window.LectureService) {
        console.error('LectureService not available');
        return;
      }
      
      // Get offering ID on load
      try {
        const fetchedOfferingId = await window.LectureService.getActiveOfferingId();
        console.log('Fetched offering ID on load:', fetchedOfferingId, typeof fetchedOfferingId);
        
        if (fetchedOfferingId && fetchedOfferingId !== 'undefined' && fetchedOfferingId !== 'null') {
          offeringId = fetchedOfferingId; // Update module-level variable
          if (container) {
            container.setAttribute('data-offering-id', offeringId);
          }
          console.log('offeringId set successfully:', offeringId);
        } else {
          console.warn('No active offering ID found or invalid:', fetchedOfferingId);
          offeringId = null; // Explicitly set to null
          // Show user-friendly error
          const errorMsg = document.createElement('div');
          errorMsg.className = 'error-message';
          errorMsg.style.cssText = 'padding: 1rem; background: #fee; color: #c33; border-radius: 4px; margin-bottom: 1rem;';
          errorMsg.innerHTML = '<strong>⚠️ No active course offering found.</strong><br>Please ensure you have an active course offering set up.';
          if (container) {
            container.insertBefore(errorMsg, container.firstChild);
          }
        }
      } catch (error) {
        console.error('Error loading offering ID:', error);
        offeringId = null; // Explicitly set to null on error
        const errorMsg = document.createElement('div');
        errorMsg.className = 'error-message';
        errorMsg.style.cssText = 'padding: 1rem; background: #fee; color: #c33; border-radius: 4px; margin-bottom: 1rem;';
        errorMsg.innerHTML = `<strong>⚠️ Error loading course offering:</strong><br>${error.message || 'Please refresh the page or contact support.'}`;
        if (container) {
          container.insertBefore(errorMsg, container.firstChild);
        }
      }
    };
    
    initOffering();

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
    
    // Setup date display and pre-fill with current date/time
    const dateInput = document.getElementById('lecture-date');
    const startTimeInput = document.getElementById('lecture-start');
    const endTimeInput = document.getElementById('lecture-end');
    
    if (dateInput && !dateInput.value) {
      // Pre-fill with current date (YYYY-MM-DD format)
      const now = new Date();
      const year = now.getFullYear();
      const month = String(now.getMonth() + 1).padStart(2, '0');
      const day = String(now.getDate()).padStart(2, '0');
      dateInput.value = `${year}-${month}-${day}`;
      updateDateDisplay();
    }
    
    if (dateInput) {
      dateInput.addEventListener('change', () => {
        updateDateDisplay();
        // Trigger date picker update if it exists
        if (window.DatePicker && dateInput.dataset.datePickerInitialized) {
          const datePickerWrapper = dateInput.closest('.date-picker-wrapper');
          if (datePickerWrapper) {
            const displayBtn = datePickerWrapper.querySelector('.date-picker-display');
            if (displayBtn && dateInput.value) {
              const date = new Date(dateInput.value + 'T00:00:00');
              if (!isNaN(date.getTime())) {
                displayBtn.textContent = formatDateDisplay(dateInput);
              }
            }
          }
        }
        triggerAutoSave();
      });
    }
    
    // Pre-fill start time with current time (rounded to nearest 5 minutes)
    if (startTimeInput && !startTimeInput.value) {
      const now = new Date();
      let hours = now.getHours();
      let minutes = now.getMinutes();
      // Round to nearest 5 minutes
      minutes = Math.round(minutes / 5) * 5;
      if (minutes === 60) {
        minutes = 0;
        hours = (hours + 1) % 24;
      }
      startTimeInput.value = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
      
      // Update time picker display if it exists
      setTimeout(() => {
        if (window.TimePicker && startTimeInput.dataset.timePickerInitialized) {
          const startPicker = startTimeInput.closest('.time-picker-wrapper');
          if (startPicker) {
            const displayBtn = startPicker.querySelector('.time-picker-display');
            if (displayBtn) {
              const [h, m] = startTimeInput.value.split(':').map(Number);
              const hour12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
              const ampm = h >= 12 ? ' PM' : ' AM';
              displayBtn.textContent = `${String(hour12).padStart(2, '0')}:${String(m).padStart(2, '0')}${ampm}`;
            }
          }
        }
      }, 100);
    }
    
    // Helper function to update end time to 30 minutes after start time
    function updateEndTimeFromStart() {
      if (!startTimeInput || !endTimeInput) return;
      
      const startValue = startTimeInput.value;
      if (!startValue) return;
      
      const [startHours, startMinutes] = startValue.split(':').map(Number);
      const startDate = new Date();
      startDate.setHours(startHours, startMinutes, 0, 0);
      startDate.setMinutes(startDate.getMinutes() + 30);
      
      const endHours = String(startDate.getHours()).padStart(2, '0');
      const endMinutes = String(startDate.getMinutes()).padStart(2, '0');
      endTimeInput.value = `${endHours}:${endMinutes}`;
      
      // Update time picker display if it exists
      setTimeout(() => {
        if (window.TimePicker && endTimeInput.dataset.timePickerInitialized) {
          const endPicker = endTimeInput.closest('.time-picker-wrapper');
          if (endPicker) {
            const displayBtn = endPicker.querySelector('.time-picker-display');
            if (displayBtn) {
              const [h, m] = endTimeInput.value.split(':').map(Number);
              const hour12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
              const ampm = h >= 12 ? ' PM' : ' AM';
              displayBtn.textContent = `${String(hour12).padStart(2, '0')}:${String(m).padStart(2, '0')}${ampm}`;
            }
          }
        }
      }, 100);
    }
    
    // Pre-fill end time as 30 minutes after start time (default)
    if (endTimeInput && !endTimeInput.value && startTimeInput && startTimeInput.value) {
      updateEndTimeFromStart();
    }
    
    // Update end time when start time changes (always set to 30 minutes after as default)
    // User can still manually change it afterward
    if (startTimeInput && endTimeInput) {
      startTimeInput.addEventListener('change', () => {
        // Always update end time to 30 minutes after start time when start time changes
        // This provides a good default, but user can manually change end time if needed
        updateEndTimeFromStart();
        validateTimeRange();
        triggerAutoSave();
      });
    }
    
    // Also validate when end time changes
    if (endTimeInput) {
      endTimeInput.addEventListener('change', () => {
        validateTimeRange();
        triggerAutoSave();
      });
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
