let currentTeam = null;

// Simple form handler
document.addEventListener('DOMContentLoaded', function() {
  loadTeamData();
  
  // Handle form submission
  const form = document.getElementById('teamEditForm');
  if (form) {
    form.onsubmit = async function(e) {
      e.preventDefault();
      await saveTeam();
    };
  }
});

async function loadTeamData() {
  try {
    const response = await fetch('/api/teams/my-team', { credentials: 'include' });
    if (!response.ok) throw new Error('Failed to load team');
    
    const data = await response.json();
    currentTeam = data.team;
    
    document.getElementById('teamName').value = currentTeam.name || '';
    document.getElementById('teamMantra').value = currentTeam.mantra || '';
    
    const title = document.getElementById('team-name-title');
    if (title) title.textContent = currentTeam.name || 'Team Settings';
  } catch (error) {
    alert('Failed to load team data');
  }
}

async function saveTeam() {
  if (!currentTeam) return;
  
  const name = document.getElementById('teamName').value.trim();
  const mantra = document.getElementById('teamMantra').value.trim();
  
  if (!name) {
    alert('Team name is required');
    return;
  }
  
  const formData = new FormData();
  formData.append('name', name);
  formData.append('mantra', mantra);
  
  try {
    const response = await fetch(`/api/teams/${currentTeam.id}`, {
      method: 'PUT',
      body: formData,
      credentials: 'include'
    });
    
    if (!response.ok) throw new Error('Failed to update team');
    
    const updated = await response.json();
    currentTeam = updated;
    
    // Update header
    const title = document.getElementById('team-name-title');
    if (title) title.textContent = updated.name;
    
    alert('Team updated successfully!');
  } catch (error) {
    alert('Failed to update team: ' + error.message);
  }
}
