// src/components/AdGateway.jsx
import { createContext, useContext, useEffect } from "react";

const AdContext = createContext();
export const useAd = () => useContext(AdContext);

export default function AdGateway({ children }) {
  // Monetag loads automatically from index.html
  useEffect(() => {
    console.log("AdGateway mounted — Monetag handled globally");
  }, []);

  // Monetag does NOT support rewarded ads
  // This is intentionally empty to avoid violations
  const value = {};

  return (
    <AdContext.Provider value={value}>
      {children}
    </AdContext.Provider>
  );
}