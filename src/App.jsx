import React, { useEffect, useState } from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";

/* ================= CONTEXT PROVIDERS ================= */
import { ThemeProvider } from "./context/ThemeContext";
import { WalletProvider } from "./context/WalletContext";
import { UserProvider } from "./context/UserContext";
import { PopupProvider } from "./context/PopupContext";
import { SettingsProvider } from "./context/SettingsContext";

/* ================= FIREBASE ================= */
import { auth, setUserPresence, db } from "./firebaseConfig";
import { doc, updateDoc, increment } from "firebase/firestore";

/* ================= ROUTE GUARD ================= */
import ProtectedRoute from "./components/ProtectedRoute";

/* ================= MAIN PAGES ================= */
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

/* ================= SETTINGS SUB-PAGES ================= */
import PrivacySettingsPage from "./pages/PrivacySettingsPage";
import NotificationSettingsPage from "./pages/NotificationSettingsPage";
import PreferencesSettingsPage from "./pages/PreferencesSettingsPage";
import DataSettingsPage from "./pages/DataSettingsPage";
import SupportSettingsPage from "./pages/SupportSettingsPage";
import AccountSettingsPage from "./pages/AccountSettingsPage";

/* ================= ADS ================= */
import AdGateway from "./components/AdGateway";

export default function App() {
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [user, setUser] = useState(null);

  /* ================= AUTH + PRESENCE ================= */
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

  /* ================= WALLET REWARD HELPER ================= */
  const rewardCoins = async (uid, amount) => {
    if (!uid) return;
    const ref = doc(db, "users", uid);
    await updateDoc(ref, { coins: increment(amount) });
  };

  /* ================= SERVICE WORKER ================= */
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      window.addEventListener("load", () => {
        navigator.serviceWorker
          .register("/monetag-sw.js")
          .then((reg) => console.log("Monetag SW registered:", reg))
          .catch((err) => console.error("Monetag SW failed:", err));
      });
    }
  }, []);

  /* ================= LOADING SCREEN ================= */
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
            animation: "pulseGlow 2s ease-in-out infinite",
          }}
        >
          <span
            style={{
              fontSize: 36,
              fontWeight: "bold",
              textShadow: "0 0 12px rgba(255,255,255,.8)",
            }}
          >
            LC
          </span>
        </div>
        <p style={{ marginTop: 16, opacity: 0.8 }}>loechat is starting…</p>
      </div>
    );
  }

  /* ================= ROUTES ================= */
  return (
    <SettingsProvider>
      <ThemeProvider>
        <WalletProvider>
          <UserProvider>
            <PopupProvider>
              <AdGateway>
                <Router>
                  <Routes>
                    {/* PUBLIC */}
                    <Route path="/" element={user ? <ChatPage /> : <HomePage />} />

                    {/* CHAT */}
                    <Route
                      path="/chat"
                      element={
                        <ProtectedRoute>
                          <ChatPage />
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="/chat/:chatId"
                      element={
                        <ProtectedRoute>
                          <ChatConversationPage />
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="/chat/:chatId/media"
                      element={
                        <ProtectedRoute>
                          <SharedMediaPage />
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="/archive"
                      element={
                        <ProtectedRoute>
                          <ArchivePage />
                        </ProtectedRoute>
                      }
                    />

                    {/* CALLS */}
                    <Route
                      path="/voice-call/:chatId/:friendId"
                      element={
                        <ProtectedRoute>
                          <VoiceCall />
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="/video-call/:chatId/:friendId"
                      element={
                        <ProtectedRoute>
                          <VideoCall />
                        </ProtectedRoute>
                      }
                    />

                    {/* SETTINGS */}
                    <Route
                      path="/settings"
                      element={
                        <ProtectedRoute>
                          <SettingsPage />
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="/settings/privacy"
                      element={
                        <ProtectedRoute>
                          <PrivacySettingsPage />
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="/settings/notifications"
                      element={
                        <ProtectedRoute>
                          <NotificationSettingsPage />
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="/settings/preferences"
                      element={
                        <ProtectedRoute>
                          <PreferencesSettingsPage />
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="/settings/data"
                      element={
                        <ProtectedRoute>
                          <DataSettingsPage />
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="/settings/support"
                      element={
                        <ProtectedRoute>
                          <SupportSettingsPage />
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="/settings/account"
                      element={
                        <ProtectedRoute>
                          <AccountSettingsPage />
                        </ProtectedRoute>
                      }
                    />

                    {/* PROFILE */}
                    <Route
                      path="/edit-profile"
                      element={
                        <ProtectedRoute>
                          <EditProfilePage />
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="/profile/:uid"
                      element={
                        <ProtectedRoute>
                          <UserProfile />
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="/friend/:uid"
                      element={
                        <ProtectedRoute>
                          <FriendProfilePage />
                        </ProtectedRoute>
                      }
                    />

                    {/* WALLET */}
                    <Route
                      path="/wallet"
                      element={
                        <ProtectedRoute>
                          <WalletPage rewardCoins={rewardCoins} />
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="/withdraw"
                      element={
                        <ProtectedRoute>
                          <WithdrawPage rewardCoins={rewardCoins} />
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="/topup"
                      element={
                        <ProtectedRoute>
                          <TopUpPage rewardCoins={rewardCoins} />
                        </ProtectedRoute>
                      }
                    />

                    {/* HISTORY */}
                    <Route
                      path="/history"
                      element={
                        <ProtectedRoute>
                          <CallHistoryPage />
                        </ProtectedRoute>
                      }
                    />
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