
// Global trackers for editing
window.editingId = null;
window.currentLogs = [];

function toggleMenu(id) {
  const menu = document.getElementById(`menu-${id}`);
  menu.classList.toggle("hidden");
}

async function deleteEntry(id) {
  if (!confirm("Delete this entry?")) return;

  await fetch(`/journal/${id}`, { method: "DELETE", credentials: "include" });
  loadEntries();
}

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

async function submitJournal() {
  const payload = {
    date: new Date().toISOString().split("T")[0],
    done_since_yesterday: document.getElementById("done").value,
    working_on_today: document.getElementById("today").value,
    blockers: document.getElementById("blockers").value,
    feelings: document.getElementById("feelings").value
  };

  let url = "/journal";
  let method = "POST";

  if (window.editingId) {
    url = `/journal/${window.editingId}`;
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
    alert("Failed to save entry.");
  }
}

async function loadEntries() {
  const res = await fetch("/journal", { credentials: "include" });
  const data = await res.json();

  const container = document.getElementById("entries");
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
    const ts = log.updated_at || log.updatedAt || log.created_at || log.createdAt;
    let dateLabel = log.date;
    if (ts) {
      const dt = new Date(ts);
      if (!isNaN(dt)) {
        const timeStr = dt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
        dateLabel = `${log.date} ${timeStr}`;
      }
    }
    const edited = log.updated_at && log.updated_at !== log.created_at;
    const editedLabel = edited ? `<span class="edited-label">(edited)</span>` : "";
    const div = document.createElement("div");
    div.className = "entry fade-in";
    div.innerHTML = `
      <div class="entry-header">
        <div class="entry-date">${dateLabel} ${editedLabel}</div>
        <div class="entry-menu" onclick="toggleMenu('${log.id}')">⋮</div>
      </div>

      <div id="menu-${log.id}" class="entry-dropdown hidden">
        <div onclick="editEntry('${log.id}')">Edit</div>
        <div onclick="deleteEntry('${log.id}')">Delete</div>
      </div>

      <div><strong>Done:</strong> ${log.done_since_yesterday}</div>
      <div><strong>Today:</strong> ${log.working_on_today}</div>
      <div><strong>Blockers:</strong> ${log.blockers}</div>
      <div><strong>Feelings:</strong> ${log.feelings}</div>
    `;
    container.appendChild(div);
  });
}

// Load entries on page load
window.onload = loadEntries;
