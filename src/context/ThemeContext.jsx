// src/context/ThemeContext.jsx
import React, { createContext, useState, useEffect } from "react";
import { db, auth } from "../firebaseConfig";
import { doc, setDoc, onSnapshot } from "firebase/firestore";

export const ThemeContext = createContext();

export const ThemeProvider = ({ children }) => {
  const [theme, setTheme] = useState("light");
  const [wallpaper, setWallpaper] = useState("");

  // ---------------- LIVE LOAD FROM FIRESTORE ----------------
  useEffect(() => {
    let unsubDoc = null;

    const unsubAuth = auth.onAuthStateChanged((user) => {
      if (!user) return;

      const userRef = doc(db, "users", user.uid);

      unsubDoc = onSnapshot(userRef, (snap) => {
        if (!snap.exists()) return;

        const data = snap.data();
        if (data.theme) setTheme(data.theme);
        if (data.wallpaper !== undefined) setWallpaper(data.wallpaper);
      });
    });

    return () => {
      if (unsubDoc) unsubDoc();
      unsubAuth();
    };
  }, []);

  // ---------------- SAVE SETTINGS ----------------
  const updateSettings = async (newTheme, newWallpaper) => {
    if (newTheme === theme && newWallpaper === wallpaper) return;

    setTheme(newTheme);
    setWallpaper(newWallpaper);

    const user = auth.currentUser;
    if (!user) return;

    const userRef = doc(db, "users", user.uid);
    await setDoc(
      userRef,
      {
        theme: newTheme,
        wallpaper: newWallpaper,
        updatedAt: Date.now(),
      },
      { merge: true }
    );
  };

  // ---------------- APPLY TO DOCUMENT ----------------
  useEffect(() => {
    const root = document.documentElement;

    root.classList.remove("light-theme", "dark-theme");
    root.classList.add(theme === "dark" ? "dark-theme" : "light-theme");

    if (wallpaper) {
      root.style.backgroundImage = `url(${wallpaper})`;
      root.style.backgroundSize = "cover";
      root.style.backgroundRepeat = "no-repeat";
      root.style.backgroundAttachment = "fixed";
    } else {
      root.style.backgroundImage = "none";
    }
  }, [theme, wallpaper]);

  return (
    <ThemeContext.Provider value={{ theme, wallpaper, updateSettings }}>
      {children}
    </ThemeContext.Provider>
  );
};