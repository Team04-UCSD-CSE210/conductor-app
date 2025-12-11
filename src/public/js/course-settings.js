/**
 * Course Settings Page Scripts
 * Handles color palette selection and saving
 */

(function() {
  const PALETTE_STORAGE_KEY = 'conductor_color_palette';
  
  // Color palette definitions
  const PALETTES = {
    default: {
      name: 'Default Teal',
      colors: {
        primary: '#0F766E',
        secondary: '#83D7CF',
        accent: '#99F6E4',
        background: '#F0FDFA'
      }
    },
    blue: {
      name: 'Ocean Blue',
      colors: {
        primary: '#1E40AF',
        secondary: '#60A5FA',
        accent: '#93C5FD',
        background: '#EFF6FF'
      }
    },
    purple: {
      name: 'Royal Purple',
      colors: {
        primary: '#6B21A8',
        secondary: '#A78BFA',
        accent: '#C4B5FD',
        background: '#F3E8FF'
      }
    },
    green: {
      name: 'Forest Green',
      colors: {
        primary: '#166534',
        secondary: '#4ADE80',
        accent: '#86EFAC',
        background: '#F0FDF4'
      }
    },
    orange: {
      name: 'Sunset Orange',
      colors: {
        primary: '#C2410C',
        secondary: '#FB923C',
        accent: '#FDBA74',
        background: '#FFF7ED'
      }
    },
    red: {
      name: 'Classic Red',
      colors: {
        primary: '#991B1B',
        secondary: '#F87171',
        accent: '#FCA5A5',
        background: '#FEF2F2'
      }
    }
  };
  
  function selectPalette(paletteId) {
    const radios = document.querySelectorAll('.palette-radio');
    
    radios.forEach(radio => {
      radio.checked = radio.value === paletteId;
    });
    
    // Apply palette immediately for preview
    applyPalette(paletteId);
  }
  
  async function loadPaletteFromServer() {
    try {
      const response = await fetch('/api/offerings/color-palette', {
        credentials: 'include'
      });
      
      if (response.ok) {
        const data = await response.json();
        return data.color_palette || 'default';
      }
    } catch (error) {
      console.warn('Failed to load palette from server:', error);
    }
    
    // Fallback to localStorage
    return localStorage.getItem(PALETTE_STORAGE_KEY) || 'default';
  }
  
  async function loadCourseInfo() {
    try {
      const response = await fetch('/api/offerings/active', {
        credentials: 'include'
      });
      
      if (!response.ok) {
        // If 404, there's no active offering - this is okay, just don't populate form
        if (response.status === 404) {
          console.log('No active course offering found. Form will remain empty.');
          return;
        }
        // For other errors, log but don't show error message to user
        console.error('Failed to load course information:', response.status, response.statusText);
        return;
      }
      
      const offering = await response.json();
      
      // Populate form fields
      if (offering.code) document.getElementById('courseCode').value = offering.code;
      if (offering.name) document.getElementById('courseName').value = offering.name;
      if (offering.department) document.getElementById('department').value = offering.department;
      if (offering.credits) document.getElementById('credits').value = offering.credits;
      if (offering.term) document.getElementById('term').value = offering.term;
      if (offering.year) document.getElementById('year').value = offering.year;
      if (offering.start_date) {
        const startDate = new Date(offering.start_date);
        document.getElementById('startDate').value = startDate.toISOString().split('T')[0];
      }
      if (offering.end_date) {
        const endDate = new Date(offering.end_date);
        document.getElementById('endDate').value = endDate.toISOString().split('T')[0];
      }
      if (offering.location) document.getElementById('location').value = offering.location;
      if (offering.enrollment_cap) document.getElementById('enrollmentCap').value = offering.enrollment_cap;
      if (offering.class_timings) {
        const timings = typeof offering.class_timings === 'string' 
          ? offering.class_timings 
          : JSON.stringify(offering.class_timings, null, 2);
        document.getElementById('classTimings').value = timings;
      }
      if (offering.syllabus_url) document.getElementById('syllabusUrl').value = offering.syllabus_url;
      if (offering.status) document.getElementById('status').value = offering.status;
      
    } catch (error) {
      console.error('Error loading course information:', error);
      // Don't show error message to user - just log it
      // The form will remain empty if course info can't be loaded
    }
  }

  async function saveCourseInfo() {
    const formData = new FormData(document.getElementById('courseInfoForm'));
    const data = {};
    
    // Collect form data
    const code = formData.get('code');
    const name = formData.get('name');
    const department = formData.get('department');
    const credits = formData.get('credits');
    const term = formData.get('term');
    const year = formData.get('year');
    const startDate = formData.get('start_date');
    const endDate = formData.get('end_date');
    const location = formData.get('location');
    const enrollmentCap = formData.get('enrollment_cap');
    const classTimings = formData.get('class_timings');
    const syllabusUrl = formData.get('syllabus_url');
    
    if (code) data.code = code;
    if (name) data.name = name;
    if (department) data.department = department;
    if (credits && credits.trim()) {
      const creditsNum = Number.parseInt(credits, 10);
      if (!Number.isNaN(creditsNum)) {
        data.credits = creditsNum;
      }
    }
    if (term) data.term = term;
    if (year && year.trim()) {
      const yearNum = Number.parseInt(year, 10);
      if (!Number.isNaN(yearNum)) {
        data.year = yearNum;
      }
    }
    if (startDate) data.start_date = startDate;
    if (endDate) data.end_date = endDate;
    if (location) data.location = location;
    if (enrollmentCap && enrollmentCap.trim()) {
      const capNum = Number.parseInt(enrollmentCap, 10);
      if (!Number.isNaN(capNum)) {
        data.enrollment_cap = capNum;
      }
    }
    if (classTimings && classTimings.trim()) {
      try {
        const parsed = JSON.parse(classTimings);
        if (parsed && typeof parsed === 'object') {
          data.class_timings = parsed;
        }
      } catch (parseError) {
        console.warn('Invalid JSON format for class timings, skipping:', parseError);
        // Don't throw - just skip invalid class_timings
      }
    }
    if (syllabusUrl) data.syllabus_url = syllabusUrl;
    
    const response = await fetch('/api/offerings/active', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify(data)
    });
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || 'Failed to save course information');
    }
    
    return response.json();
  }
  
  function initCourseSettings() {
    const saveBtn = document.getElementById('savePaletteBtn');
    const resetBtn = document.getElementById('resetPaletteBtn');
    const courseInfoForm = document.getElementById('courseInfoForm');
    const saveCourseInfoBtn = document.getElementById('saveCourseInfoBtn');
    const resetCourseInfoBtn = document.getElementById('resetCourseInfoBtn');
    
    // Load course information
    loadCourseInfo();
    
    // Load saved palette from server
    loadPaletteFromServer().then(paletteId => {
      selectPalette(paletteId);
    });
    
    // Handle palette card selection - cards are labels, so clicking automatically selects radio
    const paletteCards = document.querySelectorAll('.palette-card');
    paletteCards.forEach(card => {
      const radio = card.querySelector('.palette-radio');
        if (radio) {
        // Handle change event for immediate preview
      radio.addEventListener('change', (e) => {
        if (e.target.checked) {
          selectPalette(e.target.value);
        }
      });
      }
    });
    
    // Save palette
    if (saveBtn) {
      saveBtn.addEventListener('click', async () => {
        const selected = document.querySelector('input[name="colorPalette"]:checked');
        if (!selected) {
          showMessage('Please select a color palette first', 'error');
          return;
        }
        
        const paletteId = selected.value;
        
        // Disable button and show loading state
        saveBtn.disabled = true;
        const btnText = saveBtn.querySelector('.btn-text');
        const originalText = btnText ? btnText.textContent : saveBtn.textContent;
        if (btnText) {
          btnText.textContent = 'Saving...';
        } else {
          saveBtn.textContent = 'Saving...';
        }
        
        // Save to server (global for all users)
        try {
          const result = await savePaletteToServer(paletteId);
          showMessage(result.message || 'Color palette saved successfully! Changes will apply to all users across the entire website.', 'success');
          
          // Clear localStorage since we're using server-side storage now
          localStorage.removeItem(PALETTE_STORAGE_KEY);
        
        // Ensure palette is applied
        applyPalette(paletteId);
        
        // Reload palette loader to ensure global application
        if (window.applyColorPalette) {
          window.applyColorPalette(paletteId);
          }
        } catch (error) {
          console.error('Failed to save palette to server:', error);
          showMessage('Failed to save palette. Please try again.', 'error');
        } finally {
          // Re-enable button
          saveBtn.disabled = false;
          if (btnText) {
            btnText.textContent = originalText;
          } else {
            saveBtn.textContent = originalText;
          }
        }
      });
    }
    
    // Reset to default
    if (resetBtn) {
      resetBtn.addEventListener('click', () => {
        localStorage.setItem(PALETTE_STORAGE_KEY, 'default');
        selectPalette('default');
        showMessage('Reset to default palette', 'success');
      });
    }
    
    // Handle course information form submission
    if (courseInfoForm) {
      courseInfoForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        if (saveCourseInfoBtn) {
          saveCourseInfoBtn.disabled = true;
          const btnText = saveCourseInfoBtn.querySelector('.btn-text');
          if (btnText) {
            btnText.textContent = 'Saving...';
          } else {
            saveCourseInfoBtn.textContent = 'Saving...';
          }
        }
        
        try {
          const result = await saveCourseInfo();
          showMessage(result.message || 'Course information saved successfully!', 'success');
        } catch (error) {
          console.error('Error saving course information:', error);
          showMessage(error.message || 'Failed to save course information. Please try again.', 'error');
        } finally {
          if (saveCourseInfoBtn) {
            saveCourseInfoBtn.disabled = false;
            const btnText = saveCourseInfoBtn.querySelector('.btn-text');
            if (btnText) {
              btnText.textContent = 'Save Changes';
            } else {
              saveCourseInfoBtn.textContent = 'Save Changes';
            }
          }
        }
      });
    }
    
    // Handle reset course info button
    if (resetCourseInfoBtn) {
      resetCourseInfoBtn.addEventListener('click', () => {
        loadCourseInfo();
        showMessage('Form reset to saved values', 'success');
      });
    }
  }
  
  function applyPalette(paletteId) {
    // Use the global function if available, otherwise apply directly
    if (window.applyColorPalette) {
      window.applyColorPalette(paletteId);
    } else {
      // Fallback: apply directly
      const palette = PALETTES[paletteId] || PALETTES.default;
      const root = document.documentElement;
      
      root.style.setProperty('--teal-600', palette.colors.primary);
      root.style.setProperty('--teal-700', palette.colors.primary);
      root.style.setProperty('--emerald-50', palette.colors.background);
      root.style.setProperty('--emerald-100', palette.colors.accent);
      root.style.setProperty('--emerald-200', palette.colors.accent);
      root.style.setProperty('--emerald-400', palette.colors.secondary);
      root.style.setProperty('--emerald-500', palette.colors.secondary);
      root.style.setProperty('--emerald-700', palette.colors.primary);
      
      document.body.classList.remove('palette-default', 'palette-blue', 'palette-purple', 'palette-green', 'palette-orange', 'palette-red');
      document.body.classList.add(`palette-${paletteId}`);
    }
  }
  
  async function savePaletteToServer(paletteId) {
    // Save to server - this makes it global for all users
    const response = await fetch('/api/offerings/color-palette', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify({ color_palette: paletteId })
    });
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || 'Failed to save palette');
    }
    
    return response.json();
  }
  
  function showMessage(text, type) {
    // Remove existing messages
    const existing = document.querySelectorAll('.settings-message');
    existing.forEach(msg => msg.remove());
    
    // Create new message
    const message = document.createElement('div');
    message.className = `settings-message ${type}`;
    message.textContent = text;
    
    // Insert at top of the relevant settings section
    // Try to find the section that was just interacted with
    const activeSection = document.querySelector('.settings-section:has(.form-actions .btn-primary:disabled)') 
      || document.querySelector('.settings-section');
    
    if (activeSection) {
      const sectionHeader = activeSection.querySelector('.section-header');
      if (sectionHeader) {
        sectionHeader.insertAdjacentElement('afterend', message);
      } else {
        activeSection.insertBefore(message, activeSection.firstChild);
      }
      
      // Remove after 4 seconds with fade out
      setTimeout(() => {
        message.style.transition = 'opacity 0.2s ease';
        message.style.opacity = '0';
      setTimeout(() => {
        message.remove();
        }, 200);
      }, 4000);
    }
  }
  
  // Initialize
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initCourseSettings);
  } else {
    initCourseSettings();
  }
})();

