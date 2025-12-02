/**
 * Material Design 3 Time Picker Component
 * Creates a nice time picker interface for selecting hours and minutes
 */
(function() {
  'use strict';

  // Track all active picker instances
  const allPickers = [];

  class TimePicker {
    constructor(inputElement) {
      this.input = inputElement;
      this.container = null;
      this.picker = null;
      this.isOpen = false;
      this.hours = 12;
      this.minutes = 0;
      this.is24Hour = false;
      this.ampm = 'AM'; // 'AM' or 'PM'
      
      // Register this instance
      allPickers.push(this);
      
      this.init();
    }

    init() {
      // Create wrapper container
      this.container = document.createElement('div');
      this.container.className = 'time-picker-wrapper';
      this.input.parentNode.insertBefore(this.container, this.input);
      this.container.appendChild(this.input);
      
      // Hide native time input
      this.input.style.position = 'absolute';
      this.input.style.opacity = '0';
      this.input.style.width = '1px';
      this.input.style.height = '1px';
      this.input.style.pointerEvents = 'none';
      
      // Create display button
      this.displayButton = document.createElement('button');
      this.displayButton.type = 'button';
      this.displayButton.className = 'time-picker-display';
      this.displayButton.setAttribute('aria-label', 'Select time');
      this.displayButton.setAttribute('aria-haspopup', 'true');
      this.displayButton.setAttribute('aria-expanded', 'false');
      this.container.appendChild(this.displayButton);
      
      // Create picker dropdown
      this.picker = document.createElement('div');
      this.picker.className = 'time-picker-dropdown';
      this.picker.setAttribute('role', 'dialog');
      this.picker.setAttribute('aria-label', 'Time picker');
      this.picker.setAttribute('hidden', 'true');
      this.container.appendChild(this.picker);
      
      // Parse initial value
      if (this.input.value) {
        const [h, m] = this.input.value.split(':').map(Number);
        const hour24 = h !== undefined && !isNaN(h) ? h : 12;
        this.minutes = m !== undefined && !isNaN(m) ? m : 0;
        // Convert 24-hour to 12-hour format
        this.setHour24(hour24);
      } else {
        // Default to current time if no value
        const now = new Date();
        let hour24 = now.getHours();
        this.minutes = now.getMinutes();
        // Round minutes to nearest 5
        this.minutes = Math.round(this.minutes / 5) * 5;
        if (this.minutes === 60) {
          this.minutes = 0;
          hour24 = (hour24 + 1) % 24;
        }
        // Convert 24-hour to 12-hour format
        this.setHour24(hour24);
      }
      
      this.updateDisplay();
      this.buildPicker();
      // Initialize the input value with the 24-hour format
      this.updateValue();
      this.attachEvents();
    }

    buildPicker() {
      this.picker.innerHTML = '';
      
      // Ensure picker is hidden if it shouldn't be open
      if (!this.isOpen) {
        this.picker.setAttribute('hidden', 'true');
      }
      
      // Header
      const header = document.createElement('div');
      header.className = 'time-picker-header';
      header.innerHTML = `
        <div class="time-display-large">
          <span class="hours-display">${this.formatHours(this.hours)}</span>
          <span class="time-separator">:</span>
          <span class="minutes-display">${String(this.minutes).padStart(2, '0')}</span>
          <span class="ampm-display">${this.ampm}</span>
        </div>
      `;
      this.picker.appendChild(header);
      
      // Controls - horizontal layout with 3 columns
      const controls = document.createElement('div');
      controls.className = 'time-picker-controls';
      
      // Hours section (1-12)
      const hoursSection = document.createElement('div');
      hoursSection.className = 'time-picker-section';
      hoursSection.innerHTML = `
        <label class="time-picker-label">Hour</label>
        <div class="time-picker-buttons hours-scrollable">
          ${Array.from({ length: 12 }, (_, i) => {
            const hour = i + 1;
            const isSelected = hour === this.hours;
            return `
              <button type="button" 
                class="time-picker-btn ${isSelected ? 'selected' : ''}" 
                data-hour="${hour}"
                aria-label="${hour} ${this.ampm}">
                ${this.formatHours(hour)}
              </button>
            `;
          }).join('')}
        </div>
      `;
      controls.appendChild(hoursSection);
      
      // Minutes section
      const minutesSection = document.createElement('div');
      minutesSection.className = 'time-picker-section';
      minutesSection.innerHTML = `
        <label class="time-picker-label">Minutes</label>
        <div class="time-picker-buttons minutes-scrollable">
          ${[0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55].map(min => {
            const isSelected = min === this.minutes;
            return `
              <button type="button" 
                class="time-picker-btn ${isSelected ? 'selected' : ''}" 
                data-minute="${min}"
                aria-label="${min} minutes">
                ${String(min).padStart(2, '0')}
              </button>
            `;
          }).join('')}
        </div>
      `;
      controls.appendChild(minutesSection);
      
      // AM/PM section
      const ampmSection = document.createElement('div');
      ampmSection.className = 'time-picker-section ampm-section';
      ampmSection.innerHTML = `
        <label class="time-picker-label">Period</label>
        <div class="time-picker-buttons ampm-buttons">
          <button type="button" 
            class="time-picker-btn ampm-btn ${this.ampm === 'AM' ? 'selected' : ''}" 
            data-ampm="AM"
            aria-label="AM">
            AM
          </button>
          <button type="button" 
            class="time-picker-btn ampm-btn ${this.ampm === 'PM' ? 'selected' : ''}" 
            data-ampm="PM"
            aria-label="PM">
            PM
          </button>
        </div>
      `;
      controls.appendChild(ampmSection);
      
      this.picker.appendChild(controls);
      
      // Attach button events
      this.picker.querySelectorAll('[data-hour]').forEach(btn => {
        btn.addEventListener('click', (e) => {
          this.hours = parseInt(e.target.dataset.hour);
          this.updatePicker();
          this.updateValue();
        });
      });
      
      this.picker.querySelectorAll('[data-minute]').forEach(btn => {
        btn.addEventListener('click', (e) => {
          this.minutes = parseInt(e.target.dataset.minute);
          this.updatePicker();
          this.updateValue();
        });
      });
      
      // AM/PM buttons
      this.picker.querySelectorAll('[data-ampm]').forEach(btn => {
        btn.addEventListener('click', (e) => {
          this.ampm = e.target.dataset.ampm;
          this.updatePicker();
          this.updateValue();
        });
      });
    }

    setHour24(hour24) {
      // Convert 24-hour to 12-hour format
      if (hour24 === 0) {
        this.hours = 12;
        this.ampm = 'AM';
      } else if (hour24 < 12) {
        this.hours = hour24;
        this.ampm = 'AM';
      } else if (hour24 === 12) {
        this.hours = 12;
        this.ampm = 'PM';
      } else {
        this.hours = hour24 - 12;
        this.ampm = 'PM';
      }
    }

    getHour24() {
      // Convert 12-hour format to 24-hour
      if (this.ampm === 'AM') {
        return this.hours === 12 ? 0 : this.hours;
      } else {
        return this.hours === 12 ? 12 : this.hours + 12;
      }
    }

    formatHours(hour) {
      return String(hour).padStart(2, '0');
    }

    updateDisplay() {
      const displayText = `${this.formatHours(this.hours)}:${String(this.minutes).padStart(2, '0')} ${this.ampm}`;
      this.displayButton.textContent = displayText;
      
      // Update large display in picker if it exists
      if (this.picker) {
        const hoursDisplay = this.picker.querySelector('.hours-display');
        const minutesDisplay = this.picker.querySelector('.minutes-display');
        const ampmDisplay = this.picker.querySelector('.ampm-display');
        if (hoursDisplay) hoursDisplay.textContent = this.formatHours(this.hours);
        if (minutesDisplay) minutesDisplay.textContent = String(this.minutes).padStart(2, '0');
        if (ampmDisplay) ampmDisplay.textContent = this.ampm;
      }
    }

    updatePicker() {
      // Update selected states
      this.picker.querySelectorAll('[data-hour]').forEach(btn => {
        const hour = parseInt(btn.dataset.hour);
        btn.classList.toggle('selected', hour === this.hours);
      });
      
      this.picker.querySelectorAll('[data-minute]').forEach(btn => {
        const minute = parseInt(btn.dataset.minute);
        btn.classList.toggle('selected', minute === this.minutes);
      });
      
      // Update AM/PM selection
      this.picker.querySelectorAll('[data-ampm]').forEach(btn => {
        btn.classList.toggle('selected', btn.dataset.ampm === this.ampm);
      });
      
      this.updateDisplay();
      
      // Scroll selected buttons into view (only if picker is open)
      if (this.isOpen) {
        setTimeout(() => {
          const selectedHour = this.picker.querySelector('[data-hour].selected');
          const selectedMinute = this.picker.querySelector('[data-minute].selected');
          if (selectedHour) {
            const container = selectedHour.parentElement;
            const containerRect = container.getBoundingClientRect();
            const buttonRect = selectedHour.getBoundingClientRect();
            const offset = buttonRect.top - containerRect.top - (containerRect.height / 2) + (buttonRect.height / 2);
            container.scrollTop += offset;
          }
          if (selectedMinute) {
            const container = selectedMinute.parentElement;
            const containerRect = container.getBoundingClientRect();
            const buttonRect = selectedMinute.getBoundingClientRect();
            const offset = buttonRect.top - containerRect.top - (containerRect.height / 2) + (buttonRect.height / 2);
            container.scrollTop += offset;
          }
        }, 50);
      }
    }

    updateValue() {
      // Update the hidden input value (HH:MM format in 24-hour)
      const hour24 = this.getHour24();
      this.input.value = `${String(hour24).padStart(2, '0')}:${String(this.minutes).padStart(2, '0')}`;
      
      // Trigger change event
      this.input.dispatchEvent(new Event('change', { bubbles: true }));
    }

    open() {
      if (this.isOpen) return;
      
      // Close all other pickers (both time and date pickers)
      allPickers.forEach(picker => {
        if (picker !== this && picker.isOpen) {
          picker.close();
        }
      });
      
      // Also close any date pickers if they exist
      if (window.closeDatePickers) {
        window.closeDatePickers(this);
      }
      
      this.isOpen = true;
      this.picker.removeAttribute('hidden');
      this.displayButton.setAttribute('aria-expanded', 'true');
      this.displayButton.classList.add('active');
      
      // Ensure picker is built before scrolling
      if (this.picker.children.length === 0) {
        this.buildPicker();
      }
      
      // Check if dropdown would overflow viewport and align accordingly
      setTimeout(() => {
        const rect = this.picker.getBoundingClientRect();
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;
        
        // Reset positioning classes
        this.picker.classList.remove('align-right', 'align-top-left');
        
        // Check if it's in the sidebar (meeting form)
        const isInSidebar = this.container.closest('.attendance-sidebar');
        
        if (isInSidebar) {
          // Always position above and to the left for sidebar
          this.picker.classList.add('align-top-left');
        } else {
          // Standard positioning logic for other instances
          // If dropdown extends beyond right edge, align it to the right
          if (rect.right > viewportWidth) {
            this.picker.classList.add('align-right');
          }
        }
        
        // Scroll selected buttons into view after opening
        const selectedHour = this.picker.querySelector('[data-hour].selected');
        const selectedMinute = this.picker.querySelector('[data-minute].selected');
        if (selectedHour) {
          const container = selectedHour.parentElement;
          const containerRect = container.getBoundingClientRect();
          const buttonRect = selectedHour.getBoundingClientRect();
          const offset = buttonRect.top - containerRect.top - (containerRect.height / 2) + (buttonRect.height / 2);
          container.scrollTop += offset;
        }
        if (selectedMinute) {
          const container = selectedMinute.parentElement;
          const containerRect = container.getBoundingClientRect();
          const buttonRect = selectedMinute.getBoundingClientRect();
          const offset = buttonRect.top - containerRect.top - (containerRect.height / 2) + (buttonRect.height / 2);
          container.scrollTop += offset;
        }
      }, 10);
    }

    close() {
      if (!this.isOpen) return;
      this.isOpen = false;
      this.picker.setAttribute('hidden', 'true');
      this.displayButton.setAttribute('aria-expanded', 'false');
      this.displayButton.classList.remove('active');
    }

    toggle() {
      if (this.isOpen) {
        this.close();
      } else {
        this.open();
      }
    }

    attachEvents() {
      // Toggle picker on button click
      this.displayButton.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.toggle();
      });
      
      // Close on outside click
      document.addEventListener('click', (e) => {
        if (this.isOpen && !this.container.contains(e.target)) {
          this.close();
        }
      });
      
      // Close on escape key
      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && this.isOpen) {
          this.close();
          this.displayButton.focus();
        }
      });
      
      // Update from input changes (if changed programmatically)
      this.input.addEventListener('change', () => {
        if (this.input.value) {
          const [h, m] = this.input.value.split(':').map(Number);
          const hour24 = h !== undefined && !isNaN(h) ? h : 12;
          this.minutes = m !== undefined && !isNaN(m) ? m : 0;
          this.setHour24(hour24);
          this.updateDisplay();
          // Only update picker if it's built and open (don't trigger if picker is closed)
          if (this.isOpen && this.picker && this.picker.children.length > 0) {
            this.updatePicker();
          }
        }
      });
      
      // Also listen for input event for immediate updates
      this.input.addEventListener('input', () => {
        if (this.input.value) {
          const [h, m] = this.input.value.split(':').map(Number);
          if (h !== undefined && !isNaN(h) && m !== undefined && !isNaN(m)) {
            this.setHour24(h);
            this.minutes = m;
            this.updateDisplay();
          }
        }
      });
    }
  }

  // Initialize time pickers for all time inputs with class 'time-picker'
  function initTimePickers() {
    document.querySelectorAll('input[type="time"].time-picker').forEach(input => {
      if (!input.dataset.timePickerInitialized) {
        input.dataset.timePickerInitialized = 'true';
        new TimePicker(input);
      }
    });
  }

  // Auto-initialize on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initTimePickers);
  } else {
    initTimePickers();
  }

  // Expose a function to close all time pickers (for date picker to call)
  window.closeTimePickers = function(exceptPicker) {
    allPickers.forEach(picker => {
      if (picker !== exceptPicker && picker.isOpen) {
        picker.close();
      }
    });
  };

  // Export for manual initialization
  window.TimePicker = TimePicker;
  window.initTimePickers = initTimePickers;
})();

