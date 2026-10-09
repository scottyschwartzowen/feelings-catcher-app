# Feelings Catcher

## Description

Feelings Catcher is a voice-first feelings journal. It helps you notice an intense feeling in the moment, name it, and file it away as a journal entry, so you can look back later and see patterns in what you were doing whenever that feeling showed up.

It is designed for anyone who wants a quick, low-friction way to check in with their emotions, such as people practicing emotional awareness or tracking stress and anxiety over time.

The app is currently a UI prototype built with plain HTML, CSS, and JavaScript using Materialize CSS (hosted locally). Entry saving, voice capture, and the calendar data are placeholders and are planned for a future update.

## PWA Features

- **Web App Manifest** (`manifest.json`): app name, theme and background colors, standalone display mode, and 192/256/512px icons including a maskable icon, so the app can be installed to a device's home screen or desktop.
- **Service Worker** (`sw.js`): registered on page load, it pre-caches the app shell (HTML, CSS, JS, icons, and an offline page) on install and removes outdated caches on activate.
- **Offline support**: cached files are served cache-first so the app loads without a connection, with pages and assets cached dynamically as they are visited, and a fallback offline page (`pages/offline.html`) shown when a page cannot be loaded.
- **Custom install button**: the app listens for the `beforeinstallprompt` event and shows an "Install App" button in the navigation (desktop and mobile menu) when installation is available.
- **Responsive, mobile-friendly design**: a responsive layout with a mobile slide-out menu.
- **Dark and light themes**: dark mode by default, with a toggle that remembers the visitor's choice.
