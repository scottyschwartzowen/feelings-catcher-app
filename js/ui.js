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

  const addFeelingForm = document.querySelector("#add-feeling-form");

  if (addFeelingForm) {
    addFeelingForm.addEventListener("submit", async (event) => {
      event.preventDefault();

      const formData = new FormData(addFeelingForm);
      const feeling = {
        id: crypto.randomUUID(),
        createdAt: new Date().toISOString(),
        ...Object.fromEntries(formData),
      };

      try {
        await saveFeeling(feeling);
        M.toast({ html: "Feeling saved." });
        addFeelingForm.reset();
        M.FormSelect.init(document.querySelectorAll("select"));
      } catch (err) {
        console.error("Failed to save feeling:", err);
        M.toast({
          html: "Something went wrong saving that feeling.",
        });
      }
    });
  }
});
