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
