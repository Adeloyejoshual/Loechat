// src/main.jsx
import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// -----------------------------
// Monetag Service Worker Registration
// -----------------------------
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("/monetag-sw.js")
      .then((registration) => {
        console.log("Monetag SW registered:", registration);
      })
      .catch((err) => {
        console.error("Monetag SW registration failed:", err);
      });
  });
}