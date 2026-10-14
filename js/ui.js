// Register the service worker for offline support
if ("serviceWorker" in navigator) {
  window.addEventListener("load", async () => {
    try {
      const registration = await navigator.serviceWorker.register("/sw.js");
      console.log("Feelings Catcher service worker registered");
      console.log("Scope:", registration.scope);
    } catch (error) {
      console.error("Service worker registration failed:", error);
    }
  });
}

document.addEventListener("DOMContentLoaded", () => {
  // initialize the mobile nav menu
  const mobileMenu = document.querySelector("#mobile-menu");
  M.Sidenav.init(mobileMenu, {
    edge: "right",
  });

  // initialize the Catch a New Feeling side form
  const feelingForm = document.querySelector("#feeling-form");
  M.Sidenav.init(feelingForm, {
    edge: "left",
  });

  const selectFields = document.querySelectorAll("select");
  M.FormSelect.init(selectFields);
});
