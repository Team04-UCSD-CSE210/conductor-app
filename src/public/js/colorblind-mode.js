/**
 * Colorblind Mode Toggle
 * Handles enabling/disabling colorblind mode and persists preference
 */

(function() {
  const COLORBLIND_STORAGE_KEY = 'conductor_colorblind_mode';
  
  function initColorblindMode() {
    // Load saved preference first and apply immediately
    const savedPreference = localStorage.getItem(COLORBLIND_STORAGE_KEY);
    const isColorblind = savedPreference === 'enabled';
    
    // Apply colorblind mode immediately if enabled
    if (isColorblind) {
      updateColorblindMode(true);
    }
    
    // Wait for toggle to be created (by sidebar-nav.js or create it ourselves)
    function setupToggle() {
      let toggle = document.getElementById('colorblindToggle');
      
      // If toggle doesn't exist yet, create it as fallback
      if (!toggle) {
        const sidebarTitle = document.querySelector('.sidebar .sidebar-title');
        if (sidebarTitle && sidebarTitle.parentElement) {
          const container = document.createElement('div');
          container.className = 'colorblind-toggle-container';

          const label = document.createElement('label');
          label.className = 'colorblind-toggle-label';

          toggle = document.createElement('input');
          toggle.type = 'checkbox';
          toggle.id = 'colorblindToggle';
          toggle.className = 'colorblind-toggle-input';

          const slider = document.createElement('span');
          slider.className = 'colorblind-toggle-slider';

          const text = document.createElement('span');
          text.className = 'colorblind-toggle-text';
          text.textContent = 'Colorblind Mode';

          label.appendChild(toggle);
          label.appendChild(slider);
          label.appendChild(text);
          container.appendChild(label);

          // Insert right after the title
          sidebarTitle.parentElement.insertBefore(container, sidebarTitle.nextSibling);
        }
      }
      
      // Ensure Main Menu header exists (global fallback)
      const sidebar = document.querySelector('.sidebar');
      if (sidebar) {
        const navEl = sidebar.querySelector('nav');
        if (navEl && !sidebar.querySelector('.main-menu-header')) {
          const mainMenuHeader = document.createElement('div');
          mainMenuHeader.className = 'main-menu-header';
          mainMenuHeader.textContent = 'Main Menu';
          navEl.parentElement.insertBefore(mainMenuHeader, navEl);
        }
      }
      
      if (!toggle) {
        // Retry after a short delay if toggle still doesn't exist
        setTimeout(setupToggle, 100);
        return;
      }
      
      toggle.checked = isColorblind;
      
      // Listen for toggle changes
      toggle.addEventListener('change', (e) => {
        const enabled = e.target.checked;
        updateColorblindMode(enabled);
        localStorage.setItem(COLORBLIND_STORAGE_KEY, enabled ? 'enabled' : 'disabled');
      });
    }
    
    setupToggle();
  }
  
  function updateColorblindMode(enabled) {
    const root = document.documentElement;
    
    if (enabled) {
      document.body.classList.add('colorblind-mode');
      
      // Override palette colors with colorblind-friendly colors
      // Apply after a small delay to ensure palette-loader has run first
      setTimeout(() => {
        root.style.setProperty('--teal-600', '#0066cc');
        root.style.setProperty('--teal-700', '#0052a3');
        root.style.setProperty('--emerald-50', '#e6f3ff');
        root.style.setProperty('--emerald-100', '#cce6ff');
        root.style.setProperty('--emerald-200', '#99ccff');
        root.style.setProperty('--emerald-400', '#4da6ff');
        root.style.setProperty('--emerald-500', '#0080ff');
        root.style.setProperty('--emerald-700', '#0052a3');
        root.style.setProperty('--teal-500', '#4da6ff');
        root.style.setProperty('--emerald-600', '#0066cc');
      }, 50);
    } else {
      document.body.classList.remove('colorblind-mode');
      
      // Remove overrides - let palette reapply
      setTimeout(() => {
        if (window.applyColorPalette) {
          const savedPalette = localStorage.getItem('conductor_color_palette') || 'default';
          window.applyColorPalette(savedPalette);
        }
      }, 50);
    }
  }
  
  // Initialize on page load
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initColorblindMode);
  } else {
    initColorblindMode();
  }
})();

