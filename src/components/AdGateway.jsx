// src/components/AdGateway.jsx
import React, { createContext, useContext, useState, useEffect } from "react";

const AdContext = createContext();
export const useAd = () => useContext(AdContext);

export default function AdGateway({ children }) {
  const [adVisible, setAdVisible] = useState(false);
  const [adDuration, setAdDuration] = useState(15);
  const [timeLeft, setTimeLeft] = useState(0);
  const [onComplete, setOnComplete] = useState(null);
  const [zoneId, setZoneId] = useState(10287794); // default rewarded Popunder

  // -----------------------------
  // Load Monetag Script Once
  // -----------------------------
  useEffect(() => {
    if (!window.Monetag) {
      const script = document.createElement("script");
      script.src = "https://3nbf4.com/act/files/multitag.min.js";
      script.async = true;
      document.body.appendChild(script);
      script.onload = () => {
        console.log("Monetag script loaded");
        // Automatically render passive ad zones
        renderPassiveZones();
      };
    } else {
      renderPassiveZones();
    }
  }, []);

  // -----------------------------
  // Render Passive Ad Zones
  // -----------------------------
  const passiveZones = [
    { id: 10287795, container: "monetag-inline-wallet" }, // In-Page Push / Banner
    { id: 10287798, container: "monetag-push-notif" },   // Push Notifications
    { id: 10287797, container: "monetag-vignette-home" }, // Vignette Banner
  ];

  const renderPassiveZones = () => {
    if (!window.Monetag) return;
    passiveZones.forEach((zone) => {
      const container = document.getElementById(zone.container);
      if (container) {
        try {
          window.Monetag.loadZone({ zoneId: zone.id, container: zone.container });
        } catch (err) {
          console.error(`Failed to load Monetag passive zone ${zone.id}:`, err);
        }
      }
    });
  };

  // -----------------------------
  // Rewarded Timer Logic
  // -----------------------------
  useEffect(() => {
    let timer;
    if (adVisible && timeLeft > 0) {
      timer = setTimeout(() => setTimeLeft((prev) => prev - 1), 1000);
    } else if (adVisible && timeLeft === 0 && onComplete) {
      onComplete();
      setAdVisible(false);
    }
    return () => clearTimeout(timer);
  }, [adVisible, timeLeft, onComplete]);

  // -----------------------------
  // Load Rewarded Ad When Visible
  // -----------------------------
  useEffect(() => {
    if (adVisible && window.Monetag) {
      try {
        window.Monetag.loadZone({ zoneId: zoneId, container: "monetag-ad-container" });
      } catch (err) {
        console.error("Failed to load rewarded Monetag ad:", err);
      }
    }
  }, [adVisible, zoneId]);

  // -----------------------------
  // Show Rewarded Ad
  // -----------------------------
  const showRewarded = (selectedZoneId = 10287794, duration = 15, callback) => {
    setZoneId(selectedZoneId);
    setAdDuration(duration);
    setTimeLeft(duration);
    setOnComplete(() => callback);
    setAdVisible(true);
  };

  // -----------------------------
  // Close Ad Early
  // -----------------------------
  const closeAdEarly = () => {
    if (timeLeft <= 0) {
      setAdVisible(false);
      if (onComplete) onComplete();
    } else {
      alert(`Please watch the ad for ${timeLeft} more seconds to claim your reward.`);
    }
  };

  return (
    <AdContext.Provider value={{ showRewarded }}>
      {children}

      {/* Rewarded Ad Modal */}
      {adVisible && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            width: "100vw",
            height: "100vh",
            backgroundColor: "rgba(0,0,0,0.8)",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            zIndex: 9999,
            flexDirection: "column",
            color: "#fff",
            padding: 20,
          }}
        >
          <div
            style={{
              background: "#111",
              padding: 20,
              borderRadius: 12,
              textAlign: "center",
              width: "90%",
              maxWidth: 400,
            }}
          >
            <h2>Advertisement</h2>
            <p>Watch this ad to claim your reward!</p>

            {/* Rewarded ad container */}
            <div
              id="monetag-ad-container"
              data-zone={zoneId}
              style={{
                width: "100%",
                height: 250,
                margin: "20px 0",
                borderRadius: 12,
                background: "linear-gradient(135deg, #3b82f6, #8b5cf6)",
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
                fontSize: 24,
                fontWeight: "bold",
                color: "#fff",
              }}
            >
              Loading Ad...
            </div>

            <p>Time left: {timeLeft}s</p>
            <button
              onClick={closeAdEarly}
              style={{
                padding: "10px 20px",
                borderRadius: 8,
                border: "none",
                background: "#34d399",
                color: "#fff",
                fontWeight: "bold",
                cursor: "pointer",
              }}
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* Passive ad containers anywhere in your pages */}
      <div id="monetag-inline-wallet" style={{ display: "none" }}></div>
      <div id="monetag-push-notif" style={{ display: "none" }}></div>
      <div id="monetag-vignette-home" style={{ display: "none" }}></div>
    </AdContext.Provider>
  );
}