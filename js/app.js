let installPrompt = null;
const installBtn = document.querySelector("#installApp");
const installBtnMobile = document.querySelector("#installAppMobile");

function showInstallButtons() {
  if (installBtn) installBtn.hidden = false;
  if (installBtnMobile) installBtnMobile.hidden = false;
}

function hideInstallButtons() {
  if (installBtn) installBtn.hidden = true;
  if (installBtnMobile) installBtnMobile.hidden = true;
}

window.addEventListener("beforeinstallprompt", (event) => {
  event.preventDefault();
  installPrompt = event;
  showInstallButtons();
});

async function handleInstallClick() {
  if (!installPrompt) return;
  const result = await installPrompt.prompt();
  console.log("Install choice:", result.outcome);
  installPrompt = null;
  hideInstallButtons();
}

if (installBtn) installBtn.addEventListener("click", handleInstallClick);
if (installBtnMobile)
  installBtnMobile.addEventListener("click", handleInstallClick);

// Theme toggle, dark mode is default
const THEME_KEY = "feelings-catcher-theme";

function getStoredTheme() {
  try {
    return localStorage.getItem(THEME_KEY);
  } catch (err) {
    return null;
  }
}

function setStoredTheme(theme) {
  try {
    localStorage.setItem(THEME_KEY, theme);
  } catch (err) {
    // no localStorage yet - theme won't persist across reloads.
  }
}

function applyTheme(theme) {
  document.documentElement.setAttribute("data-theme", theme);

  const nextLabel =
    theme === "dark" ? "Switch to light mode" : "Switch to dark mode";
  document.querySelectorAll(".theme-toggle-btn").forEach((btn) => {
    btn.setAttribute("aria-label", nextLabel);
  });
  document.querySelectorAll(".theme-toggle-icon").forEach((icon) => {
    icon.textContent = theme === "dark" ? "light_mode" : "dark_mode";
  });
}

function toggleTheme() {
  const current =
    document.documentElement.getAttribute("data-theme") === "light"
      ? "light"
      : "dark";
  const next = current === "dark" ? "light" : "dark";
  setStoredTheme(next);
  applyTheme(next);
}

// Sync the toggle buttons/icons to whatever theme the head script already applied
applyTheme(
  document.documentElement.getAttribute("data-theme") === "light"
    ? "light"
    : "dark",
);

document.querySelectorAll(".theme-toggle-btn").forEach((btn) => {
  btn.addEventListener("click", toggleTheme);
});
