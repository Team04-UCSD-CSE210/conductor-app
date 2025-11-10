// js/ui.js
/**
 * Simple UI helper functions for consistent UX across Conductor modules
 */

/**
 * Create a visual toast message
 */
export function showToast(message, type = "info") {
  const toast = document.createElement("div");
  toast.className = `toast toast-${type}`;
  toast.textContent = message;
  document.body.appendChild(toast);

  setTimeout(() => toast.remove(), 3000);
}

/**
 * Create a loading spinner overlay
 */
export function showSpinner() {
  const spinner = document.createElement("div");
  spinner.className = "spinner-overlay";
  spinner.innerHTML = `<div class="spinner"></div>`;
  document.body.appendChild(spinner);
}

export function hideSpinner() {
  const overlay = document.querySelector(".spinner-overlay");
  if (overlay) overlay.remove();
}

