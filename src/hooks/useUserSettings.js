import { useEffect, useState } from "react";
import { doc, onSnapshot, updateDoc } from "firebase/firestore";
import { db } from "../firebaseConfig";

export const useUserSettings = (userId) => {
  const [settings, setSettings] = useState({
    notifications: true,
    blockedUsers: [],
    theme: "light",
  });

  useEffect(() => {
    if (!userId) return;

    const unsub = onSnapshot(doc(db, "users", userId), (docSnap) => {
      if (docSnap.exists()) {
        setSettings(docSnap.data());
      }
    });

    return () => unsub(); // Cleanup listener on unmount
  }, [userId]);

  const updateSetting = async (key, value) => {
    if (!userId) return;
    await updateDoc(doc(db, "users", userId), { [key]: value });
  };

  return [settings, updateSetting];
};