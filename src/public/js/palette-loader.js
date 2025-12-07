/**
 * Global Color Palette Loader
 * Applies saved color palette across all pages
 */

(function() {
  const PALETTE_STORAGE_KEY = 'conductor_color_palette';
  
  const PALETTES = {
    default: {
      colors: {
        primary: '#0F766E',
        secondary: '#83D7CF',
        accent: '#99F6E4',
        background: '#F0FDFA'
      }
    },
    blue: {
      colors: {
        primary: '#1E40AF',
        secondary: '#60A5FA',
        accent: '#93C5FD',
        background: '#EFF6FF'
      }
    },
    purple: {
      colors: {
        primary: '#6B21A8',
        secondary: '#A78BFA',
        accent: '#C4B5FD',
        background: '#F3E8FF'
      }
    },
    green: {
      colors: {
        primary: '#166534',
        secondary: '#4ADE80',
        accent: '#86EFAC',
        background: '#F0FDF4'
      }
    },
    orange: {
      colors: {
        primary: '#C2410C',
        secondary: '#FB923C',
        accent: '#FDBA74',
        background: '#FFF7ED'
      }
    },
    red: {
      colors: {
        primary: '#991B1B',
        secondary: '#F87171',
        accent: '#FCA5A5',
        background: '#FEF2F2'
      }
    }
  };
  
  function applyPalette(paletteId) {
    const palette = PALETTES[paletteId] || PALETTES.default;
    
    // Check if colorblind mode is active - if so, don't apply palette
    const isColorblind = document.body.classList.contains('colorblind-mode') || 
                         localStorage.getItem('conductor_colorblind_mode') === 'enabled';
    if (isColorblind) {
      // Colorblind mode takes priority - don't apply palette
      return;
    }
    
    // Apply CSS custom properties comprehensively
    const root = document.documentElement;
    
    // Primary colors (main brand color - dark)
    root.style.setProperty('--teal-600', palette.colors.primary);
    root.style.setProperty('--teal-700', palette.colors.primary);
    root.style.setProperty('--emerald-700', palette.colors.primary);
    root.style.setProperty('--emerald-600', palette.colors.primary);
    
    // Secondary colors (medium)
    root.style.setProperty('--emerald-400', palette.colors.secondary);
    root.style.setProperty('--emerald-500', palette.colors.secondary);
    root.style.setProperty('--teal-500', palette.colors.secondary);
    
    // Intermediate shades (between secondary and accent)
    root.style.setProperty('--emerald-300', palette.colors.secondary);
    
    // Accent colors (light)
    root.style.setProperty('--emerald-100', palette.colors.accent);
    root.style.setProperty('--emerald-200', palette.colors.accent);
    
    // Background colors (lightest)
    root.style.setProperty('--emerald-50', palette.colors.background);
    root.style.setProperty('--teal-50', palette.colors.background);
    
    // Palette-specific variables for direct usage
    root.style.setProperty('--palette-primary', palette.colors.primary);
    root.style.setProperty('--palette-secondary', palette.colors.secondary);
    root.style.setProperty('--palette-accent', palette.colors.accent);
    root.style.setProperty('--palette-background', palette.colors.background);
    
    // Update body class for palette-specific styling
    document.body.classList.remove('palette-default', 'palette-blue', 'palette-purple', 'palette-green', 'palette-orange', 'palette-red');
    document.body.classList.add(`palette-${paletteId}`);
  }
  
  async function loadPalette() {
    try {
      // First try to load from server (global setting)
      const response = await fetch('/api/offerings/color-palette', {
        credentials: 'include'
      });
      
      if (response.ok) {
        const data = await response.json();
        const serverPalette = data.color_palette || 'default';
        document.body.setAttribute('data-current-palette', serverPalette);
        applyPalette(serverPalette);
        return;
      }
    } catch (error) {
      console.warn('Failed to load palette from server, using localStorage fallback:', error);
    }
    
    // Fallback to localStorage if server fails
    const savedPalette = localStorage.getItem(PALETTE_STORAGE_KEY) || 'default';
    applyPalette(savedPalette);
  }
  
  // Load palette immediately
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', loadPalette);
  } else {
    loadPalette();
  }
  
  // Expose function globally for course-settings.js to use
  window.applyColorPalette = applyPalette;
  
  // Expose palette colors for JavaScript use (charts, etc.)
  window.getPaletteColors = async function() {
    // Check if colorblind mode is active
    const isColorblind = document.body.classList.contains('colorblind-mode') || 
                         localStorage.getItem('conductor_colorblind_mode') === 'enabled';
    
    if (isColorblind) {
      return {
        primary: '#0066cc',
        secondary: '#4da6ff',
        accent: '#99ccff',
        background: '#e6f3ff'
      };
    }
    
    // Try to get from server first (synchronous for immediate use)
    // If async needed, use getPaletteColorsAsync
    let paletteId = localStorage.getItem(PALETTE_STORAGE_KEY) || 'default';
    
    // Check if server value is available (set by loadPalette)
    const serverPalette = document.body.getAttribute('data-current-palette');
    if (serverPalette) {
      paletteId = serverPalette;
    }
    
    const palette = PALETTES[paletteId] || PALETTES.default;
    return palette.colors;
  };
  
  // Async version for when server fetch is needed
  window.getPaletteColorsAsync = async function() {
    // Check if colorblind mode is active
    const isColorblind = document.body.classList.contains('colorblind-mode') || 
                         localStorage.getItem('conductor_colorblind_mode') === 'enabled';
    
    if (isColorblind) {
      return {
        primary: '#0066cc',
        secondary: '#4da6ff',
        accent: '#99ccff',
        background: '#e6f3ff'
      };
    }
    
    // Try to fetch from server
    try {
      const response = await fetch('/api/offerings/color-palette', {
        credentials: 'include'
      });
      
      if (response.ok) {
        const data = await response.json();
        const paletteId = data.color_palette || 'default';
        const palette = PALETTES[paletteId] || PALETTES.default;
        return palette.colors;
      }
    } catch (error) {
      console.warn('Failed to fetch palette from server:', error);
    }
    
    // Fallback to localStorage
    const paletteId = localStorage.getItem(PALETTE_STORAGE_KEY) || 'default';
    const palette = PALETTES[paletteId] || PALETTES.default;
    return palette.colors;
  };
})();

