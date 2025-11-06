const user = JSON.parse(localStorage.getItem("currentUser"));
const userInfo = document.getElementById("userInfo");
const roleSection = document.getElementById("roleSection");

if (!user) {
  window.location.href = "login.html";
}

userInfo.innerHTML = `Logged in as: <strong>${user.email}</strong> (${user.role})`;

document.getElementById("logoutBtn").addEventListener("click", () => {
  localStorage.removeItem("currentUser");
  window.location.href = "login.html";
});

const rolePermissions = {
  "Instructor": ["View all users", "Manage roles", "View logs"],
  "Teaching Assistant": ["View class", "Manage attendance", "Submit reports"],
  "Tutor": ["View assignments", "Assist students"],
  "Student Leader": ["View team progress", "Submit group journal"],
  "Student Standard": ["View personal data", "Submit attendance"]
};

const perms = rolePermissions[user.role] || [];
roleSection.innerHTML = `<h3>Permissions:</h3><ul>${perms.map(p => `<li>${p}</li>`).join("")}</ul>`;

