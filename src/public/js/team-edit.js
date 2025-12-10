document.addEventListener('DOMContentLoaded', async function() {
  const teamEditForm = document.getElementById('teamEditForm');
  const logoUpload = document.getElementById('logoUpload');
  const saveImageBtn = document.getElementById('saveImageBtn');
  const currentLogo = document.getElementById('currentLogo');
  const loadingOverlay = document.getElementById('loadingOverlay');
  
  let currentTeam = null;
  let selectedFile = null;

  // Handle logo file selection
  if (logoUpload) {
    logoUpload.addEventListener('change', function(e) {
      const file = e.target.files[0];
      if (file) {
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
        await saveTeamData();
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
    
    // Populate links
    const links = team.links || {};
    document.getElementById('slackLink').value = links.slack || '';
    document.getElementById('repoLink').value = links.repo || '';
  }

  // Handle logo file selection
  logoUpload.addEventListener('change', function(e) {
    const file = e.target.files[0];
    const saveImageBtn = document.getElementById('saveImageBtn');
    
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
      
      // Preview the selected image
      const reader = new FileReader();
      reader.onload = function(e) {
        currentLogo.src = e.target.result;
      };
      reader.readAsDataURL(file);
      
      // Show save image button
      saveImageBtn.style.display = 'inline-block';
    }
  });

  // Handle separate image save
  document.getElementById('saveImageBtn').addEventListener('click', async function() {
    if (!selectedFile) {
      alert('No image selected');
      return;
    }

    const formData = new FormData();
    formData.append('logo', selectedFile);

    try {
      loadingOverlay.style.display = 'flex';
      
      const response = await fetch(`/api/teams/${currentTeam.id}`, {
        method: 'PUT',
        body: formData
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to update team logo');
      }
      
      const updatedTeam = await response.json();
      alert('Team logo updated successfully!');
      
      // Update current team data and hide save button
      currentTeam = updatedTeam;
      selectedFile = null;
      document.getElementById('saveImageBtn').style.display = 'none';
      
      // Refresh class directory if on that page
      if (window.location.pathname.includes('class-directory') && typeof refreshTeamsData === 'function') {
        refreshTeamsData();
      }
      
    } catch (error) {
      console.error('Error updating team logo:', error);
      alert('Failed to update team logo: ' + error.message);
    } finally {
      loadingOverlay.style.display = 'none';
    }
  });

  // Handle all form submissions
  async function saveTeamData() {
    console.log('saveTeamData called');
    const teamName = document.getElementById('teamName').value.trim();
    if (!teamName) {
      alert('Team name is required');
      return;
    }

    console.log('Preparing form data...');
    const formData = new FormData();
    
    // Add form fields
    formData.append('name', teamName);
    formData.append('mantra', document.getElementById('teamMantra').value.trim());
    
    // Add links as JSON
    const links = {
      slack: document.getElementById('slackLink').value.trim(),
      repo: document.getElementById('repoLink').value.trim(),
      mattermost: document.getElementById('mmLink').value.trim()
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
        body: formData
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to update team');
      }
      
      const updatedTeam = await response.json();
      alert('Team updated successfully!');
      
      // Refresh the form with updated data
      currentTeam = updatedTeam;
      populateForm(currentTeam);
      selectedFile = null; // Clear selected file after successful upload
      
      // Refresh class directory if on that page
      if (window.location.pathname.includes('class-directory') && typeof refreshTeamsData === 'function') {
        refreshTeamsData();
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
      console.log('Form submitted, calling saveTeamData...');
      await saveTeamData();
    });
  } else {
    console.error('teamEditForm element not found');
  }

  // Handle links form submission
  const linksForm = document.querySelector('.settings-section:last-child form');
  if (linksForm) {
    linksForm.addEventListener('submit', async function(e) {
      e.preventDefault();
      await saveTeamData();
    });
  }

  // Initialize
  await loadTeamData();
});
