import { logEvent } from "../utils/logger.js";
import { showToast, showSpinner, hideSpinner } from "./ui.js";

document.getElementById("loginForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  showSpinner();

  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value.trim();
  const error = document.getElementById("error");

  try {
    const response = await fetch("data/users.json");
    const users = await response.json();
    const user = users.find(u => u.email === email && u.password === password);

    if (user) {
      localStorage.setItem("currentUser", JSON.stringify(user));
      logEvent("LOGIN_SUCCESS", email);
      showToast("Welcome back!", "info");
      window.location.href = "dashboard.html";
    } else {
      error.textContent = "Invalid credentials. Try again.";
      logEvent("LOGIN_FAIL", email);
      showToast("Invalid credentials. Try again.", "error");
    }
  } catch (err) {
    console.error(err);
    error.textContent = "Login failed. Please refresh.";
    logEvent("LOGIN_FAIL", email);
    showToast("Login failed!", "error");
  } finally {
    hideSpinner();
  }
});
