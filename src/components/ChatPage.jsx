// src/components/ChatPage.jsx
import React, { useEffect, useState, useContext, useRef } from "react";
import { collection, query, where, orderBy, onSnapshot, getDoc, doc, updateDoc } from "firebase/firestore";
import { db, auth } from "../firebaseConfig";
import { useNavigate } from "react-router-dom";
import { ThemeContext } from "../context/ThemeContext";
import { UserContext } from "../context/UserContext";

import ChatHeader from "./ChatPage/Header";
import AddFriendPopup from "./ChatPage/AddFriendPopup";

export default function ChatPage() {
  const { theme, wallpaper } = useContext(ThemeContext);
  const { user } = useContext(UserContext);
  const isDark = theme === "dark";
  const navigate = useNavigate();

  const [chats, setChats] = useState([]);
  const [newMessages, setNewMessages] = useState({});
  const [search, setSearch] = useState("");
  const [showAddFriend, setShowAddFriend] = useState(false);

  useEffect(() => {
    const unsubAuth = auth.onAuthStateChanged(u => {
      if (!u) navigate("/");
    });
    return unsubAuth;
  }, [navigate]);

  useEffect(() => {
    if (!user) return;
    const q = query(
      collection(db, "chats"),
      where("participants", "array-contains", user.uid),
      orderBy("lastMessageAt", "desc")
    );

    const unsub = onSnapshot(q, async snapshot => {
      const chatList = await Promise.all(snapshot.docs.map(async d => {
        const chat = { id: d.id, ...d.data() };
        const friendId = chat.participants.find(p => p !== user.uid);
        if (friendId) {
          const uDoc = await getDoc(doc(db, "users", friendId));
          if (uDoc.exists()) {
            const u = uDoc.data();
            chat.name = u.name || u.email || chat.name;
            chat.photoURL = u.profilePic || chat.photoURL || null;
          }
        }
        // New message detection
        if (chat.lastMessageSender !== user.uid && chat.lastMessageStatus !== "seen") {
          setNewMessages(prev => ({ ...prev, [chat.id]: true }));
        } else {
          setNewMessages(prev => {
            const copy = { ...prev };
            delete copy[chat.id];
            return copy;
          });
        }
        return chat;
      }));

      // pinned first
      chatList.sort((a, b) => (a.pinned && !b.pinned ? -1 : !a.pinned && b.pinned ? 1 : (b.lastMessageAt?.seconds || 0) - (a.lastMessageAt?.seconds || 0)));
      setChats(chatList.filter(c => !c.deleted));
    });

    return () => unsub();
  }, [user]);

  const handleChatClick = async chat => {
    if (newMessages[chat.id]) {
      await updateDoc(doc(db, "chats", chat.id), { lastMessageStatus: "seen" });
      setNewMessages(prev => {
        const copy = { ...prev };
        delete copy[chat.id];
        return copy;
      });
    }
    navigate(`/chat/${chat.id}`);
  };

  const handlePin = async chatId => {
    const chatRef = doc(db, "chats", chatId);
    const chatSnap = await getDoc(chatRef);
    if (!chatSnap.exists()) return;
    const pinned = chatSnap.data().pinned || false;
    await updateDoc(chatRef, { pinned: !pinned });
  };

  const formatDate = ts => {
    if (!ts) return "";
    const date = new Date(ts.seconds ? ts.seconds * 1000 : ts);
    const now = new Date();
    const yesterday = new Date();
    yesterday.setDate(now.getDate() - 1);

    if (date.toDateString() === now.toDateString()) return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    if (date.toDateString() === yesterday.toDateString()) return "Yesterday";
    return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  };

  const truncatedMessage = text => (text?.length > 35 ? text.slice(0, 35) + "…" : text);
  const visibleChats = chats.filter(c => !c.archived);
  const searchResults = chats.filter(c => c.name?.toLowerCase().includes(search.toLowerCase()) || c.lastMessage?.toLowerCase().includes(search.toLowerCase()));

  return (
    <div style={{ background: wallpaper || (isDark ? "#121212" : "#fff"), minHeight: "100vh", color: isDark ? "#fff" : "#000", paddingBottom: "90px" }}>
      <ChatHeader user={user} isDark={isDark} />

      {/* Search */}
      <div style={{ padding: 10 }}>
        <input
          type="text"
          placeholder="Search chats..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ width: "100%", padding: 8, borderRadius: 8, border: "1px solid #ccc" }}
        />
      </div>

      {/* Archived shortcut */}
      <div onClick={() => navigate("/archive")} style={{ padding: 10, margin: "5px 0", background: isDark ? "#333" : "#eee", borderRadius: 8, cursor: "pointer", textAlign: "center", fontWeight: "bold" }}>
        📦 Archived Chats
      </div>

      {/* Chat List */}
      <div style={{ padding: 10 }}>
        {(search ? searchResults : visibleChats).map(chat => {
          const isNew = newMessages[chat.id];
          return (
            <div
              key={chat.id}
              onClick={() => handleChatClick(chat)}
              onContextMenu={e => { e.preventDefault(); handlePin(chat.id); }}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: 10,
                borderBottom: isDark ? "1px solid #333" : "1px solid #eee",
                cursor: "pointer",
                background: chat.pinned ? "rgba(255,255,0,0.2)" : "transparent",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ width: 45, height: 45, borderRadius: "50%", overflow: "hidden", background: "#888", display: "flex", justifyContent: "center", alignItems: "center", color: "#fff", fontWeight: "bold" }}>
                  {chat.photoURL ? <img src={chat.photoURL} style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : chat.name ? chat.name[0].toUpperCase() : "U"}
                </div>
                <div>
                  <strong>{chat.name || "Unknown"}</strong>
                  <p style={{ margin: 0, fontSize: 14, color: isNew ? "#0d6efd" : isDark ? "#ccc" : "#555" }}>
                    {truncatedMessage(chat.lastMessage || "No messages yet")}
                  </p>
                </div>
              </div>
              <small style={{ color: isNew ? "#0d6efd" : "#888" }}>{formatDate(chat.lastMessageAt)}</small>
            </div>
          );
        })}
      </div>

      {/* Floating Add Friend */}
      <button onClick={() => setShowAddFriend(true)} style={{ position: "fixed", bottom: 90, right: 25, width: 60, height: 60, borderRadius: "50%", background: "#0d6efd", color: "#fff", fontSize: 30, border: "none", cursor: "pointer" }}>+</button>
      {showAddFriend && <AddFriendPopup user={user} onClose={() => setShowAddFriend(false)} />}
    </div>
  );
}