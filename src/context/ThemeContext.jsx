// src/context/ThemeContext.jsx
import React, { createContext, useState, useEffect } from "react";
import { db, auth } from "../firebaseConfig";
import { doc, getDoc, setDoc } from "firebase/firestore";

export const ThemeContext = createContext();

export const ThemeProvider = ({ children }) => {
  const [theme, setTheme] = useState("light");
  const [wallpaper, setWallpaper] = useState("");

  // Load settings when user logs in
  useEffect(() => {
    const loadSettings = async () => {
      const user = auth.currentUser;
      if (!user) return;

      const userRef = doc(db, "users", user.uid);
      const snap = await getDoc(userRef);

      if (snap.exists()) {
        const data = snap.data();
        if (data.theme) setTheme(data.theme);
        if (data.wallpaper) setWallpaper(data.wallpaper);
      }
    };

    loadSettings();
  }, []);

  // Save settings to Firebase
  const updateSettings = async (newTheme, newWallpaper) => {
    setTheme(newTheme);
    setWallpaper(newWallpaper);

    const user = auth.currentUser;
    if (user) {
      const userRef = doc(db, "users", user.uid);
      await setDoc(
        userRef,
        { theme: newTheme, wallpaper: newWallpaper },
        { merge: true }
      );
    }
  };

  // Apply theme class + wallpaper to document
  useEffect(() => {
    const root = document.documentElement;

    // Remove old theme classes
    root.classList.remove("light-theme", "dark-theme");

    // Apply new one
    root.classList.add(theme === "dark" ? "dark-theme" : "light-theme");

    // Apply wallpaper if set
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