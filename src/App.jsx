import React, { useEffect, useState } from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";

// --------------------
// Context Providers
// --------------------
import { ThemeProvider } from "./context/ThemeContext";
import { WalletProvider } from "./context/WalletContext";
import { UserProvider } from "./context/UserContext";
import { PopupProvider } from "./context/PopupContext";
import { SettingsProvider } from "./context/SettingsContext";

// --------------------
// Firebase
// --------------------
import { auth, setUserPresence, db } from "./firebaseConfig";
import { doc, updateDoc, increment } from "firebase/firestore";

// --------------------
// Route Guard
// --------------------
import ProtectedRoute from "./components/ProtectedRoute";

// --------------------
// Main Pages
// --------------------
import HomePage from "./components/HomePage";
import ChatPage from "./components/ChatPage";
import ChatConversationPage from "./components/ChatConversationPage";
import SharedMediaPage from "./components/SharedMediaPage";
import ArchivePage from "./components/ChatPage/ArchivePage";
import VoiceCall from "./components/VoiceCall";
import VideoCall from "./components/VideoCall";
import SettingsPage from "./components/SettingsPage";
import WalletPage from "./components/WalletPage";
import WithdrawPage from "./components/WithdrawPage";
import TopUpPage from "./components/TopUpPage";
import CallHistoryPage from "./components/CallHistoryPage";
import EditProfilePage from "./components/EditProfilePage";
import UserProfile from "./components/UserProfile";
import FriendProfilePage from "./components/FriendProfilePage";

// --------------------
// Settings Sub Pages
// --------------------
import ApplicationPreferencesSettings from "./components/settings/ApplicationPreferencesSettings";
import DataAndStorageSettings from "./components/settings/DataAndStorageSettings";
import NotificationSettings from "./components/settings/NotificationSettings";
import PrivacyAndSecuritySettings from "./components/settings/PrivacyAndSecuritySettings";
import SupportAndAboutSettings from "./components/settings/SupportAndAboutSettings";

// --------------------
// Ads
// --------------------
import AdGateway from "./components/AdGateway";

export default function App() {
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [user, setUser] = useState(null);

  // -----------------------------
  // Auth + Presence
  // -----------------------------
  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((u) => {
      setUser(u);
      setTimeout(() => setCheckingAuth(false), 800);

      if (u) {
        const cleanup = setUserPresence(u.uid);
        return () => cleanup && cleanup();
      }
    });

    return () => unsubscribe();
  }, []);

  // -----------------------------
  // Reward Coins Helper
  // -----------------------------
  const rewardCoins = async (uid, amount) => {
    if (!uid) return;
    const ref = doc(db, "users", uid);
    await updateDoc(ref, { coins: increment(amount) });
  };

  // -----------------------------
  // Monetag Service Worker
  // -----------------------------
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      window.addEventListener("load", () => {
        navigator.serviceWorker.register("/monetag-sw.js").catch(() => {});
      });
    }
  }, []);

  // -----------------------------
  // Loading Screen
  // -----------------------------
  if (checkingAuth) {
    return (
      <div
        style={{
          height: "100vh",
          background: "#000",
          color: "#fff",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div
          style={{
            width: 120,
            height: 120,
            borderRadius: "50%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background:
              "linear-gradient(135deg,#3b82f6,#8b5cf6,#06b6d4,#2563eb)",
            backgroundSize: "300% 300%",
          }}
        >
          <span style={{ fontSize: 36, fontWeight: "bold" }}>LC</span>
        </div>
        <p style={{ marginTop: 16, opacity: 0.8 }}>loechat is starting…</p>
      </div>
    );
  }

  // -----------------------------
  // Routes
  // -----------------------------
  return (
    <SettingsProvider>
      <ThemeProvider>
        <WalletProvider>
          <UserProvider>
            <PopupProvider>
              <AdGateway>
                <Router>
                  <Routes>

                    {/* Public */}
                    <Route path="/" element={user ? <ChatPage /> : <HomePage />} />

                    {/* Chat */}
                    <Route path="/chat" element={<ProtectedRoute><ChatPage /></ProtectedRoute>} />
                    <Route path="/chat/:chatId" element={<ProtectedRoute><ChatConversationPage /></ProtectedRoute>} />
                    <Route path="/chat/:chatId/media" element={<ProtectedRoute><SharedMediaPage /></ProtectedRoute>} />
                    <Route path="/archive" element={<ProtectedRoute><ArchivePage /></ProtectedRoute>} />

                    {/* Calls */}
                    <Route path="/voice-call/:chatId/:friendId" element={<ProtectedRoute><VoiceCall /></ProtectedRoute>} />
                    <Route path="/video-call/:chatId/:friendId" element={<ProtectedRoute><VideoCall /></ProtectedRoute>} />

                    {/* Profile */}
                    <Route path="/edit-profile" element={<ProtectedRoute><EditProfilePage /></ProtectedRoute>} />
                    <Route path="/profile/:uid" element={<ProtectedRoute><UserProfile /></ProtectedRoute>} />
                    <Route path="/friend/:uid" element={<ProtectedRoute><FriendProfilePage /></ProtectedRoute>} />

                    {/* Settings */}
                    <Route path="/settings" element={<ProtectedRoute><SettingsPage /></ProtectedRoute>} />
                    <Route path="/settings/app-preferences" element={<ProtectedRoute><ApplicationPreferencesSettings /></ProtectedRoute>} />
                    <Route path="/settings/data-storage" element={<ProtectedRoute><DataAndStorageSettings /></ProtectedRoute>} />
                    <Route path="/settings/notifications" element={<ProtectedRoute><NotificationSettings /></ProtectedRoute>} />
                    <Route path="/settings/privacy-security" element={<ProtectedRoute><PrivacyAndSecuritySettings /></ProtectedRoute>} />
                    <Route path="/settings/support" element={<ProtectedRoute><SupportAndAboutSettings /></ProtectedRoute>} />

                    {/* Wallet */}
                    <Route path="/wallet" element={<ProtectedRoute><WalletPage rewardCoins={rewardCoins} /></ProtectedRoute>} />
                    <Route path="/withdraw" element={<ProtectedRoute><WithdrawPage rewardCoins={rewardCoins} /></ProtectedRoute>} />
                    <Route path="/topup" element={<ProtectedRoute><TopUpPage rewardCoins={rewardCoins} /></ProtectedRoute>} />
                    <Route path="/daily-bonus" element={<ProtectedRoute><HomePage rewardCoins={rewardCoins} /></ProtectedRoute>} />

                    {/* History */}
                    <Route path="/history" element={<ProtectedRoute><CallHistoryPage /></ProtectedRoute>} />

                  </Routes>
                </Router>
              </AdGateway>
            </PopupProvider>
          </UserProvider>
        </WalletProvider>
      </ThemeProvider>
    </SettingsProvider>
  );
}