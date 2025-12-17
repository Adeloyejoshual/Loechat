// src/components/AdGateway.jsx
import { createContext, useContext } from "react";

const AdContext = createContext();
export const useAd = () => useContext(AdContext);

export default function AdGateway({ children }) {
  // Stub for rewarded ads
  const showRewarded = async (zoneId, duration, onComplete) => {
    console.log(`Rewarded ad requested: zone=${zoneId}, duration=${duration}s`);

    // ✅ Simulate ad delay
    await new Promise((resolve) => setTimeout(resolve, duration * 1000));

    console.log("Rewarded ad completed (simulated)");
    if (onComplete) onComplete();
  };

  const value = { showRewarded };
  return <AdContext.Provider value={value}>{children}</AdContext.Provider>;
}