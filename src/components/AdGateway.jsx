// src/components/AdGateway.jsx
import React, { createContext, useContext, useState, useEffect } from "react";

const AdContext = createContext();
export const useAd = () => useContext(AdContext);

export default function AdGateway({ children }) {
  const [adVisible, setAdVisible] = useState(false);
  const [adDuration, setAdDuration] = useState(15); // default 15 seconds
  const [timeLeft, setTimeLeft] = useState(0);
  const [onComplete, setOnComplete] = useState(null);
  const [zoneId, setZoneId] = useState(10287794); // Default zone (Popunder)

  // -----------------------------
  // Load Monetag Script Once
  // -----------------------------
  useEffect(() => {
    if (!window.Monetag) {
      const script = document.createElement("script");
      script.src = "https://3nbf4.com/act/files/multitag.min.js";
      script.async = true;
      document.body.appendChild(script);
    }
  }, []);

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
  // Load Monetag Ad When Visible
  // -----------------------------
  useEffect(() => {
    if (adVisible && window.Monetag) {
      try {
        window.Monetag.loadZone({
          zoneId: zoneId,
          container: "monetag-ad-container",
        });
      } catch (err) {
        console.error("Failed to load Monetag ad:", err);
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

            {/* Monetag Multitag Container */}
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
    </AdContext.Provider>
  );
}