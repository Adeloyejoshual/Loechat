import React, { createContext, useContext, useEffect, useState } from "react";
import { auth, db } from "../firebaseConfig";
import { doc, onSnapshot, setDoc } from "firebase/firestore";

const SettingsContext = createContext();
export const useSettings = () => useContext(SettingsContext);

const DEFAULT_SETTINGS = {
  notifications: {
    messages: true,
    sound: true,
    vibration: true,
    showOnline: true,
  },
  appLock: {
    enabled: false,
    pinHash: "",
    timeout: 60,
  },
  language: "en",
  timeFormat: "12h",
};

export const SettingsProvider = ({ children }) => {
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let unsubDoc = null;

    const unsubAuth = auth.onAuthStateChanged((user) => {
      if (!user) return;

      const ref = doc(db, "users", user.uid);

      unsubDoc = onSnapshot(ref, (snap) => {
        if (!snap.exists()) return;

        const data = snap.data();
        setSettings({
          ...DEFAULT_SETTINGS,
          ...(data.settings || {}),
        });
        setLoading(false);
      });
    });

    return () => {
      if (unsubDoc) unsubDoc();
      unsubAuth();
    };
  }, []);

  const updateSettings = async (partial) => {
    const user = auth.currentUser;
    if (!user) return;

    const newSettings = {
      ...settings,
      ...partial,
    };

    setSettings(newSettings);

    const ref = doc(db, "users", user.uid);
    await setDoc(
      ref,
      {
        settings: newSettings,
        updatedAt: Date.now(),
      },
      { merge: true }
    );
  };

  return (
    <SettingsContext.Provider value={{ settings, updateSettings, loading }}>
      {children}
    </SettingsContext.Provider>
  );
};