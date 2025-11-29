// Global trackers for editing
window.editingId = null;
window.currentLogs = [];

// Form submission for TA journal
async function submitTAJournal(event) {
  event.preventDefault();
  
  try {
    const payload = {
      date: new Date().toISOString().split("T")[0],
      interactions: document.getElementById("interactions").value,
      groups_with_concerns: document.getElementById("groups-with-concerns").value,
      students_to_reach: document.getElementById("students-to-reach").value
    };

    let url = "/api/ta-journals";
    let method = "POST";

    if (window.editingId) {
      url = `/api/ta-journals/${window.editingId}`;
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
      loadTAEntries();
    } else {
      alert("Failed to save entry: " + (data.error || "Unknown error"));
    }
  } catch (error) {
    console.error("Error submitting TA journal:", error);
    alert("Error submitting journal. Check console for details.");
  }
}

function clearForm() {
  document.getElementById("interactions").value = "";
  document.getElementById("groups-with-concerns").value = "";
  document.getElementById("students-to-reach").value = "";
}

async function loadTAEntries() {
  try {
    const res = await fetch("/api/ta-journals", { credentials: "include" });
    
    if (!res.ok) {
      throw new Error(`HTTP error! status: ${res.status}`);
    }
    
    const data = await res.json();

    const container = document.querySelector(".wj-previous");
    if (!container) {
      console.error("Container .wj-previous not found!");
      return;
    }
    
    // Clear existing entries but keep the title
    const title = container.querySelector(".wj-section-title");
    container.innerHTML = "";
    if (title) {
      container.appendChild(title);
    } else {
      container.innerHTML = '<h2 class="wj-section-title">Previous Activity:</h2>';
    }

    if (!data.logs || data.logs.length === 0) {
      const noEntries = document.createElement("p");
      noEntries.textContent = "No previous entries yet.";
      container.appendChild(noEntries);
      return;
    }

    // Sort latest first
    data.logs.sort((a, b) => {
      const tb = new Date(b.updated_at || b.updatedAt || b.created_at || b.createdAt || b.date);
      const ta = new Date(a.updated_at || a.updatedAt || a.created_at || a.createdAt || a.date);
      return tb - ta;
    });

    window.currentLogs = data.logs;

    data.logs.forEach((log) => {
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
          <dt>Interactions:</dt>
          <dd>${log.interactions || 'N/A'}</dd>

          <dt>Groups with Concerns:</dt>
          <dd>${log.groups_with_concerns || 'N/A'}</dd>

          <dt>Students to Reach:</dt>
          <dd>${log.students_to_reach || 'N/A'}</dd>
        </dl>
      `;
      container.appendChild(article);
    });
  } catch (error) {
    console.error("Error loading TA entries:", error);
    const container = document.querySelector(".wj-previous");
    if (container) {
      container.innerHTML = '<h2 class="wj-section-title">Previous Activity:</h2><p>Error loading entries. Check console for details.</p>';
    }
  }
}

// Attach form submission handler
document.addEventListener('DOMContentLoaded', () => {
  const form = document.querySelector('.wj-form');
  if (form) {
    form.addEventListener('submit', submitTAJournal);
  }
  
  loadTAEntries();
});
