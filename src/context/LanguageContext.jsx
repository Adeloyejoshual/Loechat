// src/context/LanguageContext.jsx
import React, { createContext, useState, useEffect } from "react";
import { auth, db } from "../firebaseConfig";
import { doc, onSnapshot } from "firebase/firestore";

export const LanguageContext = createContext();

export const LanguageProvider = ({ children }) => {
  const [language, setLanguage] = useState("en");

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((user) => {
      if (!user) return;

      const userRef = doc(db, "users", user.uid);
      const unsubSnap = onSnapshot(userRef, (snap) => {
        if (!snap.exists()) return;
        const prefs = snap.data()?.preferences || {};
        if (prefs.language && prefs.language !== language) {
          setLanguage(prefs.language);
        }
      });

      return () => unsubSnap();
    });
  }, []);

  return <LanguageContext.Provider value={{ language, setLanguage }}>{children}</LanguageContext.Provider>;
};