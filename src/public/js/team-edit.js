document.addEventListener('DOMContentLoaded', async function() {
  const teamEditForm = document.getElementById('teamEditForm');
  const logoUpload = document.getElementById('logoUpload');
  const saveImageBtn = document.getElementById('saveImageBtn');
  const currentLogo = document.getElementById('currentLogo');
  const loadingOverlay = document.getElementById('loadingOverlay');
  const toastContainer = document.getElementById('toastContainer');
  
  let currentTeam = null;
  let selectedFile = null;

  // Toast notification function
  function showToast(message, type = 'success', timeout = 4000) {
    if (!toastContainer) return;
    
    const toast = document.createElement('div');
    toast.className = `toast ${type === 'error' ? 'error' : ''}`;
    toast.textContent = message;
    toastContainer.appendChild(toast);
    
    // Remove toast after timeout
    setTimeout(() => {
      toast.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
      toast.style.opacity = '0';
      toast.style.transform = 'translateX(100%)';
      setTimeout(() => toast.remove(), 300);
    }, timeout);
  }

  // Handle logo file selection
  if (logoUpload) {
    logoUpload.addEventListener('change', function(e) {
      const file = e.target.files[0];
      if (file) {
        // Validate file size (5MB limit)
        if (file.size > 5 * 1024 * 1024) {
          alert('File size must be less than 5MB');
          logoUpload.value = '';
          return;
        }

        // Validate file type
        if (!file.type.startsWith('image/')) {
          alert('Please select an image file');
          logoUpload.value = '';
          return;
        }

        selectedFile = file;
        
        // Show preview
        const reader = new FileReader();
        reader.onload = function(e) {
          currentLogo.src = e.target.result;
        };
        reader.readAsDataURL(file);
        
        // Show save button
        if (saveImageBtn) {
          saveImageBtn.style.display = 'inline-block';
        }
      }
    });
  }

  // Handle save image button
  if (saveImageBtn) {
    saveImageBtn.addEventListener('click', async function() {
      if (selectedFile && currentTeam) {
        await saveLogoOnly();
      }
    });
  }

  // Get user's team automatically
  async function getUserTeam() {
    try {
      const teamResponse = await fetch('/api/teams/my-team', {
        credentials: 'include'
      });
      if (!teamResponse.ok) {
        if (teamResponse.status === 404) {
          throw new Error('You are not assigned as a team leader');
        }
        throw new Error('Failed to get user team');
      }
      
      const data = await teamResponse.json();
      return data.team || data;
    } catch (error) {
      console.error('Error getting user team:', error);
      throw error;
    }
  }

  // Load team data
  async function loadTeamData() {
    try {
      currentTeam = await getUserTeam();
      if (!currentTeam || !currentTeam.id) {
        alert('You are not assigned to a team or are not a team leader');
        window.location.href = '/dashboard';
        return;
      }
      
      populateForm(currentTeam);
    } catch (error) {
      console.error('Error loading team:', error);
      if (error.message.includes('team leader')) {
        alert('You must be a team leader to access team settings');
      } else {
        alert('Failed to load team data. Please check your connection and try again.');
      }
      window.location.href = '/dashboard';
    }
  }

  // Populate form with team data
  function populateForm(team) {
    document.getElementById('teamName').value = team.name || '';
    document.getElementById('teamMantra').value = team.mantra || '';
    
    // Update header team name
    const teamNameTitle = document.getElementById('team-name-title');
    if (teamNameTitle) {
      teamNameTitle.textContent = team.name || 'Team Settings';
    }
    
    // Set current logo
    if (team.logo_url) {
      currentLogo.src = team.logo_url;
    }
    
    // Populate links - handle both string and object formats
    let links = team.links || {};
    if (typeof links === 'string') {
      try {
        links = JSON.parse(links);
      } catch (e) {
        console.warn('Failed to parse team links JSON:', e);
        links = {};
      }
    }
    
    document.getElementById('slackLink').value = links.slack || '';
    document.getElementById('repoLink').value = links.repo || '';
  }

  // Save logo only
  async function saveLogoOnly() {
    if (!selectedFile || !currentTeam) {
      alert('No image selected or team not loaded');
      return;
    }

    const formData = new FormData();
    formData.append('logo', selectedFile);

    try {
      loadingOverlay.style.display = 'flex';
      
      const response = await fetch(`/api/teams/${currentTeam.id}`, {
        method: 'PUT',
        credentials: 'include',
        body: formData
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to update team logo');
      }
      
      const updatedTeam = await response.json();
      showToast('Team logo updated successfully!', 'success');
      
      // Update current team data and hide save button
      currentTeam = updatedTeam;
      selectedFile = null;
      if (saveImageBtn) {
        saveImageBtn.style.display = 'none';
      }
      
      // Update logo display
      if (updatedTeam.logo_url) {
        currentLogo.src = updatedTeam.logo_url;
      }
      
    } catch (error) {
      console.error('Error updating team logo:', error);
      alert('Failed to update team logo: ' + error.message);
    } finally {
      loadingOverlay.style.display = 'none';
    }
  }

  // Save all team data
  async function saveTeamData() {
    const teamName = document.getElementById('teamName').value.trim();
    if (!teamName) {
      alert('Team name is required');
      return;
    }

    const formData = new FormData();
    
    // Add form fields
    formData.append('name', teamName);
    formData.append('mantra', document.getElementById('teamMantra').value.trim());
    
    // Add links as JSON
    const links = {
      slack: document.getElementById('slackLink').value.trim(),
      repo: document.getElementById('repoLink').value.trim()
    };
    formData.append('links', JSON.stringify(links));
    
    // Add logo file if selected
    if (selectedFile) {
      formData.append('logo', selectedFile);
    }
    
    try {
      loadingOverlay.style.display = 'flex';
      
      const response = await fetch(`/api/teams/${currentTeam.id}`, {
        method: 'PUT',
        credentials: 'include',
        body: formData
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to update team');
      }
      
      const updatedTeam = await response.json();
      showToast('Team updated successfully!', 'success');
      
      // Refresh the form with updated data
      currentTeam = updatedTeam;
      populateForm(currentTeam);
      selectedFile = null; // Clear selected file after successful upload
      
      // Hide save image button
      if (saveImageBtn) {
        saveImageBtn.style.display = 'none';
      }
      
    } catch (error) {
      console.error('Error updating team:', error);
      alert('Failed to update team: ' + error.message);
    } finally {
      loadingOverlay.style.display = 'none';
    }
  }

  // Handle team info form submission
  if (teamEditForm) {
    teamEditForm.addEventListener('submit', async function(e) {
      e.preventDefault();
      await saveTeamData();
    });
  }

  // Handle links form submission
  const linksForm = document.getElementById('teamLinksForm');
  if (linksForm) {
    linksForm.addEventListener('submit', async function(e) {
      e.preventDefault();
      await saveTeamData();
    });
  }

  // Initialize
  await loadTeamData();
});
