/**
 * Material Design 2 Date Picker Component
 * Creates a calendar picker interface for selecting dates
 */
(function() {
  'use strict';

  // Track all active picker instances
  const allDatePickers = [];

  class DatePicker {
    constructor(inputElement) {
      this.input = inputElement;
      this.container = null;
      this.picker = null;
      this.isOpen = false;
      this.currentDate = new Date();
      this.selectedDate = null;
      
      // Register this instance
      allDatePickers.push(this);
      
      this.init();
    }

    init() {
      // Parse initial value
      if (this.input.value) {
        const date = new Date(this.input.value + 'T00:00:00');
        if (!isNaN(date.getTime())) {
          this.selectedDate = date;
          this.currentDate = new Date(date);
        } else {
          // Invalid date, default to today
          this.currentDate = new Date();
        }
      } else {
        // If no value, set currentDate to today and select today by default
        const today = new Date();
        this.currentDate = new Date(today);
        this.selectedDate = new Date(today);
        this.input.value = this.formatDateForInput(today);
      }
      
      // Create wrapper container
      this.container = document.createElement('div');
      this.container.className = 'date-picker-wrapper';
      this.input.parentNode.insertBefore(this.container, this.input);
      this.container.appendChild(this.input);
      
      // Hide native date input
      this.input.style.position = 'absolute';
      this.input.style.opacity = '0';
      this.input.style.width = '1px';
      this.input.style.height = '1px';
      this.input.style.pointerEvents = 'none';
      
      // Create display button
      this.displayButton = document.createElement('button');
      this.displayButton.type = 'button';
      this.displayButton.className = 'date-picker-display';
      this.displayButton.setAttribute('aria-label', 'Select date');
      this.displayButton.setAttribute('aria-haspopup', 'true');
      this.displayButton.setAttribute('aria-expanded', 'false');
      this.updateDisplay();
      this.container.appendChild(this.displayButton);
      
      // Create picker dropdown
      this.picker = document.createElement('div');
      this.picker.className = 'date-picker-dropdown';
      this.picker.setAttribute('role', 'dialog');
      this.picker.setAttribute('aria-label', 'Date picker');
      this.picker.setAttribute('hidden', 'true');
      this.container.appendChild(this.picker);
      
      this.buildPicker();
      this.attachEvents();
    }

    formatDate(date) {
      if (!date) return '';
      return date.toLocaleDateString('en-US', { 
        month: 'short', 
        day: 'numeric', 
        year: 'numeric' 
      });
    }

    updateDisplay() {
      const displayText = this.selectedDate 
        ? this.formatDate(this.selectedDate)
        : 'Select date';
      this.displayButton.textContent = displayText;
    }

    buildPicker() {
      this.picker.innerHTML = '';
      
      // Header with month/year navigation
      const header = document.createElement('div');
      header.className = 'date-picker-header';
      
      const prevMonth = document.createElement('button');
      prevMonth.type = 'button';
      prevMonth.className = 'date-picker-nav';
      prevMonth.setAttribute('aria-label', 'Previous month');
      prevMonth.innerHTML = `
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M12.5 15L7.5 10L12.5 5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      `;
      prevMonth.addEventListener('click', () => this.navigateMonth(-1));
      
      const monthYear = document.createElement('div');
      monthYear.className = 'date-picker-month-year';
      this.updateMonthYearDisplay(monthYear);
      
      const nextMonth = document.createElement('button');
      nextMonth.type = 'button';
      nextMonth.className = 'date-picker-nav';
      nextMonth.setAttribute('aria-label', 'Next month');
      nextMonth.innerHTML = `
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M7.5 5L12.5 10L7.5 15" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      `;
      nextMonth.addEventListener('click', () => this.navigateMonth(1));
      
      header.appendChild(prevMonth);
      header.appendChild(monthYear);
      header.appendChild(nextMonth);
      this.picker.appendChild(header);
      
      // Weekday headers
      const weekdays = document.createElement('div');
      weekdays.className = 'date-picker-weekdays';
      const weekdayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
      weekdayNames.forEach(day => {
        const dayEl = document.createElement('div');
        dayEl.className = 'date-picker-weekday';
        dayEl.textContent = day;
        weekdays.appendChild(dayEl);
      });
      this.picker.appendChild(weekdays);
      
      // Calendar grid
      this.calendarGrid = document.createElement('div');
      this.calendarGrid.className = 'date-picker-grid';
      this.picker.appendChild(this.calendarGrid);
      
      this.renderCalendar();
    }

    updateMonthYearDisplay(element) {
      const month = this.currentDate.toLocaleDateString('en-US', { month: 'long' });
      const year = this.currentDate.getFullYear();
      element.textContent = `${month} ${year}`;
    }

    navigateMonth(direction) {
      this.currentDate.setMonth(this.currentDate.getMonth() + direction);
      this.renderCalendar();
      const monthYearEl = this.picker.querySelector('.date-picker-month-year');
      if (monthYearEl) {
        this.updateMonthYearDisplay(monthYearEl);
      }
    }

    renderCalendar() {
      this.calendarGrid.innerHTML = '';
      
      const year = this.currentDate.getFullYear();
      const month = this.currentDate.getMonth();
      
      // First day of month
      const firstDay = new Date(year, month, 1);
      const lastDay = new Date(year, month + 1, 0);
      
      // Start from the Sunday of the week containing the first day
      const startDate = new Date(firstDay);
      startDate.setDate(startDate.getDate() - startDate.getDay());
      
      // End at the Saturday of the week containing the last day
      const endDate = new Date(lastDay);
      endDate.setDate(endDate.getDate() + (6 - endDate.getDay()));
      
      // Generate all days
      const currentDate = new Date(startDate);
      while (currentDate <= endDate) {
        const dayEl = document.createElement('button');
        dayEl.type = 'button';
        dayEl.className = 'date-picker-day';
        
        // Store the date values before mutation
        const dateYear = currentDate.getFullYear();
        const dateMonth = currentDate.getMonth();
        const dateDay = currentDate.getDate();
        
        const day = dateDay;
        const isCurrentMonth = dateMonth === month;
        const isToday = this.isToday(currentDate);
        const isSelected = this.selectedDate && this.isSameDay(currentDate, this.selectedDate);
        
        dayEl.textContent = day;
        dayEl.dataset.date = this.formatDateForInput(currentDate);
        
        if (!isCurrentMonth) {
          dayEl.classList.add('other-month');
        }
        if (isToday) {
          dayEl.classList.add('today');
        }
        if (isSelected) {
          dayEl.classList.add('selected');
        }
        
        // Create a fresh date object for the click handler to avoid mutation issues
        dayEl.addEventListener('click', () => {
          const selectedDate = new Date(dateYear, dateMonth, dateDay);
          this.selectDate(selectedDate);
        });
        
        this.calendarGrid.appendChild(dayEl);
        
        currentDate.setDate(currentDate.getDate() + 1);
      }
    }

    isToday(date) {
      const today = new Date();
      return this.isSameDay(date, today);
    }

    isSameDay(date1, date2) {
      return date1.getFullYear() === date2.getFullYear() &&
             date1.getMonth() === date2.getMonth() &&
             date1.getDate() === date2.getDate();
    }

    formatDateForInput(date) {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    }

    selectDate(date) {
      this.selectedDate = new Date(date);
      this.input.value = this.formatDateForInput(date);
      this.updateDisplay();
      this.renderCalendar();
      this.close();
      
      // Trigger change event
      this.input.dispatchEvent(new Event('change', { bubbles: true }));
    }

    open() {
      if (this.isOpen) return;
      
      // Close all other date pickers
      allDatePickers.forEach(picker => {
        if (picker !== this && picker.isOpen) {
          picker.close();
        }
      });
      
      // Also close any time pickers if they exist
      if (window.closeTimePickers) {
        window.closeTimePickers(this);
      }
      
      this.isOpen = true;
      this.picker.removeAttribute('hidden');
      this.displayButton.setAttribute('aria-expanded', 'true');
      this.displayButton.classList.add('active');
      
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
        
        // Scroll selected day into view
        const selectedDay = this.picker.querySelector('.date-picker-day.selected');
        if (selectedDay) {
          selectedDay.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
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
          const date = new Date(this.input.value + 'T00:00:00');
          if (!isNaN(date.getTime())) {
            this.selectedDate = date;
            this.currentDate = new Date(date);
            this.updateDisplay();
            this.renderCalendar();
          }
        }
      });
    }
  }

  // Initialize date pickers for all date inputs with class 'date-picker'
  function initDatePickers() {
    document.querySelectorAll('input[type="date"].date-picker').forEach(input => {
      if (!input.dataset.datePickerInitialized) {
        input.dataset.datePickerInitialized = 'true';
        new DatePicker(input);
      }
    });
  }

  // Auto-initialize on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initDatePickers);
  } else {
    initDatePickers();
  }

  // Expose a function to close all date pickers (for time picker to call)
  window.closeDatePickers = function(exceptPicker) {
    allDatePickers.forEach(picker => {
      if (picker !== exceptPicker && picker.isOpen) {
        picker.close();
      }
    });
  };

  // Export for manual initialization
  window.DatePicker = DatePicker;
  window.initDatePickers = initDatePickers;
})();

