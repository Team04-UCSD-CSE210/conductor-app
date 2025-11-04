import { logEvent } from './logger.js';
import { showToast, showSpinner, hideSpinner } from './ui.js';

document.getElementById("loginForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  showSpinner();

  try {
    // ... existing fetch and credential check ...
    logEvent("LOGIN_SUCCESS", email);
    showToast("Welcome back!", "info");
    window.location.href = "dashboard.html";
  } catch (err) {
    showToast("Login failed!", "error");
    logEvent("LOGIN_FAIL", email);
  } finally {
    hideSpinner();
  }
});


document.getElementById("loginForm").addEventListener("submit", async (e) => {
  e.preventDefault();

  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value.trim();
  const error = document.getElementById("error");

  try {
    const response = await fetch("data/users.json");
    const users = await response.json();
    const user = users.find(u => u.email === email && u.password === password);

    if (user) {
      localStorage.setItem("currentUser", JSON.stringify(user));
      window.location.href = "dashboard.html";
    } else {
      error.textContent = "Invalid credentials. Try again.";
    }
  } catch (err) {
    console.error(err);
    error.textContent = "Login failed. Please refresh.";
  }
});

