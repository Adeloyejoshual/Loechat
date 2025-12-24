// src/context/ThemeContext.jsx
import React, { createContext, useState, useEffect, useCallback } from "react";
import { db, auth } from "../firebaseConfig";
import { doc, setDoc, onSnapshot } from "firebase/firestore";

export const ThemeContext = createContext();

export const ThemeProvider = ({ children }) => {
  const [theme, setTheme] = useState("light");
  const [wallpaper, setWallpaper] = useState("");

  // ---------------- DETECT SYSTEM PREFERENCE ----------------
  useEffect(() => {
    const systemPrefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    setTheme(systemPrefersDark ? "dark" : "light");
  }, []);

  // ---------------- LIVE LOAD FROM FIRESTORE ----------------
  useEffect(() => {
    let unsubDoc = null;

    const unsubAuth = auth.onAuthStateChanged((user) => {
      if (!user) return;

      const userRef = doc(db, "users", user.uid);

      unsubDoc = onSnapshot(
        userRef,
        (snap) => {
          if (!snap.exists()) return;

          const data = snap.data();
          setTheme(data?.theme || theme); // system theme remains default
          setWallpaper(data?.wallpaper || "");
        },
        (err) => {
          console.error("Theme snapshot error:", err);
        }
      );
    });

    return () => {
      unsubDoc?.();
      unsubAuth();
    };
  }, [theme]);

  // ---------------- SAVE SETTINGS ----------------
  const updateSettings = useCallback(async (newTheme, newWallpaper) => {
    setTheme(newTheme);
    setWallpaper(newWallpaper);

    try {
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
    } catch (err) {
      console.error("Failed to update theme settings:", err);
    }
  }, []);

  // ---------------- TOGGLE THEME HELPER ----------------
  const toggleTheme = () => {
    updateSettings(theme === "dark" ? "light" : "dark", wallpaper);
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
    <ThemeContext.Provider
      value={{ theme, wallpaper, updateSettings, toggleTheme }}
    >
      {children}
    </ThemeContext.Provider>
  );
};