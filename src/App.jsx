import React, { useEffect, useState } from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";

// Context Providers
import { ThemeProvider } from "./context/ThemeContext";
import { WalletProvider } from "./context/WalletContext";
import { UserProvider } from "./context/UserContext";
import { PopupProvider } from "./context/PopupContext";
import { SettingsProvider } from "./context/SettingsContext"; // NEW

// Firebase
import { auth, setUserPresence, db } from "./firebaseConfig";
import { doc, updateDoc, increment } from "firebase/firestore";

// Protected Route
import ProtectedRoute from "./components/ProtectedRoute";

// Pages
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
import AdGateway from "./components/AdGateway";

export default function App() {
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [user, setUser] = useState(null);

  // -----------------------------
  // Firebase Auth + Presence
  // -----------------------------
  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((u) => {
      setUser(u);
      setTimeout(() => setCheckingAuth(false), 800); // loading animation

      if (u) {
        const cleanupPresence = setUserPresence(u.uid);
        return () => cleanupPresence && cleanupPresence();
      }
    });

    return () => unsubscribe();
  }, []);

  // -----------------------------
  // Reward Coins Helper
  // -----------------------------
  const rewardCoins = async (uid, amount) => {
    if (!uid) return;
    const userRef = doc(db, "users", uid);
    await updateDoc(userRef, { coins: increment(amount) });
  };

  // -----------------------------
  // Monetag Service Worker Registration
  // -----------------------------
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
              "linear-gradient(135deg, #3b82f6, #8b5cf6, #06b6d4, #2563eb)",
            animation:
              "gradientShift 5s ease infinite, pulseGlow 2s ease-in-out infinite",
            backgroundSize: "300% 300%",
          }}
        >
          <span
            style={{
              fontSize: 36,
              fontWeight: "bold",
              textShadow: "0 0 12px rgba(255,255,255,0.8)",
            }}
          >
            LC
          </span>
        </div>
        <p style={{ marginTop: 16, opacity: 0.8, fontSize: 15 }}>
          loechat is starting…
        </p>
      </div>
    );
  }

  // -----------------------------
  // App Routes
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
                    {/* Public Route */}
                    <Route path="/" element={user ? <ChatPage /> : <HomePage />} />

                    {/* Chat Routes */}
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

                    {/* Voice / Video Calls */}
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

                    {/* Profile & Settings */}
                    <Route
                      path="/settings"
                      element={
                        <ProtectedRoute>
                          <SettingsPage />
                        </ProtectedRoute>
                      }
                    />
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

                    {/* Wallet / Payments */}
                    <Route
                      path="/wallet"
                      element={
                        <ProtectedRoute>
                          <WalletPage rewardCoins={rewardCoins} />
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="/daily-bonus"
                      element={
                        <ProtectedRoute>
                          <HomePage rewardCoins={rewardCoins} />
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

                    {/* Call History */}
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