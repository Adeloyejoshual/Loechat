// src/context/LanguageContext.jsx
import React, { createContext, useState, useEffect } from "react";
import { auth, db } from "../firebaseConfig";
import { doc, onSnapshot } from "firebase/firestore";

export const LanguageContext = createContext();

export const LanguageProvider = ({ children }) => {
  const [language, setLanguage] = useState("en");

  useEffect(() => {
    const unsub = auth.onAuthStateChanged((user) => {
      if (!user) return;
      const userRef = doc(db, "users", user.uid);

      const unsubscribe = onSnapshot(userRef, (snap) => {
        if (!snap.exists()) return;
        const data = snap.data();
        if (data.preferences?.language) setLanguage(data.preferences.language);
      });

      return () => unsubscribe();
    });
  }, []);

  const changeLanguage = (lang) => setLanguage(lang);

  return (
    <LanguageContext.Provider value={{ language, setLanguage: changeLanguage }}>
      {children}
    </LanguageContext.Provider>
  );
};