// Global trackers for editing
window.editingId = null;
window.currentLogs = [];

// These functions are used in HTML onclick handlers
// eslint-disable-next-line no-unused-vars
function toggleMenu(id) {
  const menu = document.getElementById(`menu-${id}`);
  menu.classList.toggle("hidden");
}

// eslint-disable-next-line no-unused-vars
async function deleteEntry(id) {
  if (!confirm("Delete this entry?")) return;

  await fetch(`/api/journals/${id}`, { method: "DELETE", credentials: "include" });
  loadEntries();
}

// eslint-disable-next-line no-unused-vars
function editEntry(id) {
  const entry = window.currentLogs.find((e) => e.id === id);
  if (!entry) return;

  document.getElementById("done").value = entry.done_since_yesterday;
  document.getElementById("today").value = entry.working_on_today;
  document.getElementById("blockers").value = entry.blockers;
  document.getElementById("feelings").value = entry.feelings;

  window.editingId = id;
}

function clearForm() {
  document.getElementById("done").value = "";
  document.getElementById("today").value = "";
  document.getElementById("blockers").value = "";
  document.getElementById("feelings").value = "";
}

// This function is used in HTML onclick handlers
// eslint-disable-next-line no-unused-vars
async function submitJournal() {
  try {
    const payload = {
      date: new Date().toISOString().split("T")[0],
      done_since_yesterday: document.getElementById("done").value,
      working_on_today: document.getElementById("today").value,
      blockers: document.getElementById("blockers").value,
      feelings: document.getElementById("feelings").value
    };

    let url = "/api/journals";
    let method = "POST";

    if (window.editingId) {
      url = `/api/journals/${window.editingId}`;
      method = "PUT";
      delete payload.date;
    }

    const res = await fetch(url, {
      method,
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    const data = await res.json();

    if (data.success) {
      alert(window.editingId ? "Entry updated!" : "Entry saved!");
      window.editingId = null;
      clearForm();
      loadEntries();
    } else {
      alert("Failed to save entry: " + (data.error || "Unknown error"));
    }
  } catch (error) {
    console.error("Error submitting journal:", error);
    alert("Error submitting journal. Check console for details.");
  }
}

async function loadEntries() {
  try {
    const res = await fetch("/api/journals", { credentials: "include" });
    
    if (!res.ok) {
      throw new Error(`HTTP error! status: ${res.status}`);
    }
    
    const data = await res.json();

    const container = document.getElementById("entries");
    if (!container) {
      console.error("Container #entries not found!");
      return;
    }
    
    container.innerHTML = "";

    if (!data.logs || data.logs.length === 0) {
      container.innerHTML = "<p>No previous entries yet.</p>";
      return;
    }

    // Sort latest first (use updated_at/updatedAt, then created_at/createdAt, fallback to date)
    data.logs.sort((a, b) => {
      const tb = new Date(b.updated_at || b.updatedAt || b.created_at || b.createdAt || b.date);
      const ta = new Date(a.updated_at || a.updatedAt || a.created_at || a.createdAt || a.date);
      return tb - ta;
    });

    // Save logs globally for editing
    window.currentLogs = data.logs;

    data.logs.forEach((log) => {
      // Format date properly
      const dateObj = new Date(log.date || log.created_at || log.createdAt);
      const dateLabel = dateObj.toLocaleDateString('en-US', { 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
      });

      const article = document.createElement("article");
      article.className = "wj-entry";
      article.innerHTML = `
        <header class="wj-entry-header">
          <span class="wj-entry-icon" aria-hidden="true">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="18" height="18" role="img" aria-hidden="true" focusable="false">
              <rect x="3" y="4" width="18" height="17" rx="2" ry="2" fill="none" stroke="currentColor" stroke-width="1.6" />
              <line x1="3" y1="9" x2="21" y2="9" stroke="currentColor" stroke-width="1.6" />
              <line x1="8" y1="3" x2="8" y2="7" stroke="currentColor" stroke-width="1.6" />
              <line x1="16" y1="3" x2="16" y2="7" stroke="currentColor" stroke-width="1.6" />
            </svg>
          </span>
          <p class="wj-entry-date">${dateLabel}</p>
        </header>

        <dl class="wj-entry-details">
          <dt>Done since yesterday:</dt>
          <dd>${log.done_since_yesterday || 'N/A'}</dd>

          <dt>Working on:</dt>
          <dd>${log.working_on_today || 'N/A'}</dd>

          <dt>Blockers:</dt>
          <dd>${log.blockers || 'N/A'}</dd>

          <dt>Feelings:</dt>
          <dd>${log.feelings || 'N/A'}</dd>
        </dl>
      `;
      container.appendChild(article);
    });
  } catch (error) {
    console.error("Error loading entries:", error);
    const container = document.getElementById("entries");
    if (container) {
      container.innerHTML = "<p>Error loading entries. Check console for details.</p>";
    }
  }
}

function initContactButtons() {
  const contactTA = document.getElementById('contact-ta');
  const contactInstructor = document.getElementById('contact-instructor');
  const handler = (recipient) => () => window.alert(`Message the ${recipient} through Slack or email.`);

  if (contactTA) contactTA.addEventListener('click', handler('TA'));
  if (contactInstructor) contactInstructor.addEventListener('click', handler('Instructor'));
}

// Load entries on page load
window.onload = () => {
  loadEntries();
  initContactButtons();
};