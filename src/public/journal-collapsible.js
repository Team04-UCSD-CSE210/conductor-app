// src/public/journal-collapsible.js

document.addEventListener("DOMContentLoaded", () => {
  const teamHeaders = document.querySelectorAll("[data-team-toggle]");

  teamHeaders.forEach((header) => {
    header.addEventListener("click", () => {
      const group = header.closest(".wj-overview-group");
      if (!group) return;

      const isExpanded = group.classList.toggle("is-expanded");
      header.setAttribute("aria-expanded", String(isExpanded));
    });
  });
});
