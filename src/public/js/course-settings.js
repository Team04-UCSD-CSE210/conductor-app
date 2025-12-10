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
    // Update visual selection
    const paletteOptions = document.querySelectorAll('.palette-option');
    paletteOptions.forEach(option => {
      option.classList.remove('selected');
      const radio = option.querySelector('input[type="radio"]');
      if (radio && radio.value === paletteId) {
        option.classList.add('selected');
        radio.checked = true;
      } else if (radio) {
        radio.checked = false;
      }
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
  
  function initCourseSettings() {
    const saveBtn = document.getElementById('savePaletteBtn');
    const resetBtn = document.getElementById('resetPaletteBtn');
    const paletteOptions = document.querySelectorAll('.palette-option');
    const paletteRadios = document.querySelectorAll('input[name="colorPalette"]');
    
    // Load saved palette from server
    loadPaletteFromServer().then(paletteId => {
      selectPalette(paletteId);
    });
    
    // Make entire palette cards clickable
    paletteOptions.forEach(option => {
      option.addEventListener('click', (e) => {
        // Don't trigger if clicking the label/checkbox directly
        if (e.target.type === 'radio' || e.target.type === 'checkbox') return;
        
        const radio = option.querySelector('input[type="radio"]');
        if (radio) {
          radio.checked = true;
          selectPalette(radio.value);
        }
      });
    });
    
    // Handle radio button changes (for keyboard/accessibility)
    paletteRadios.forEach(radio => {
      radio.addEventListener('change', (e) => {
        if (e.target.checked) {
          selectPalette(e.target.value);
        }
      });
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
        
        // Save to server (global for all users)
        try {
          const result = await savePaletteToServer(paletteId);
          showMessage(result.message || 'Color palette saved successfully! Changes will apply to all users across the entire website.', 'success');
          
          // Clear localStorage since we're using server-side storage now
          localStorage.removeItem(PALETTE_STORAGE_KEY);
        } catch (error) {
          console.error('Failed to save palette to server:', error);
          showMessage('Failed to save palette. Please try again.', 'error');
          return;
        }
        
        // Ensure palette is applied
        applyPalette(paletteId);
        
        // Reload palette loader to ensure global application
        if (window.applyColorPalette) {
          window.applyColorPalette(paletteId);
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
    const existing = document.querySelector('.settings-message');
    if (existing) {
      existing.remove();
    }
    
    // Create new message
    const message = document.createElement('div');
    message.className = `settings-message ${type}`;
    message.textContent = text;
    
    // Insert at top of settings section
    const settingsSection = document.querySelector('.settings-section');
    if (settingsSection) {
      settingsSection.insertBefore(message, settingsSection.firstChild);
      
      // Remove after 3 seconds
      setTimeout(() => {
        message.remove();
      }, 3000);
    }
  }
  
  // Initialize
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initCourseSettings);
  } else {
    initCourseSettings();
  }
})();

