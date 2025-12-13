// src/pages/GlobalSearchPage.jsx
import React, { useState, useContext } from "react";
import { collectionGroup, query, where, getDocs, orderBy } from "firebase/firestore";
import { useNavigate } from "react-router-dom";
import { db } from "../firebaseConfig";
import { UserContext } from "../context/UserContext";

export default function GlobalSearchPage() {
  const { currentUser } = useContext(UserContext);
  const myUid = currentUser?.uid;
  const navigate = useNavigate();

  const [searchText, setSearchText] = useState("");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);

  // search messages across all chats
  const handleSearch = async () => {
    if (!searchText.trim()) return;
    setLoading(true);

    try {
      const q = query(
        collectionGroup(db, "messages"),
        where("participants", "array-contains", myUid),
        orderBy("createdAt", "desc")
      );

      const snap = await getDocs(q);
      const filtered = snap.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .filter((m) => m.text?.toLowerCase().includes(searchText.toLowerCase()));

      setResults(filtered);
    } catch (err) {
      console.error("Global search error", err);
    }

    setLoading(false);
  };

  // navigate to chat at the specific message
  const openMessage = (msg) => {
    navigate(`/chat/${msg.chatId}`, { state: { highlightMessageId: msg.id } });
  };

  // highlight search term in text
  const highlightText = (text) => {
    const regex = new RegExp(`(${searchText})`, "gi");
    return text.split(regex).map((part, i) =>
      part.toLowerCase() === searchText.toLowerCase() ? (
        <span key={i} style={{ backgroundColor: "#ffeb3b" }}>{part}</span>
      ) : (
        part
      )
    );
  };

  return (
    <div style={{ padding: 16 }}>
      <h2>Global Search</h2>
      <input
        type="text"
        placeholder="Search all messages..."
        value={searchText}
        onChange={(e) => setSearchText(e.target.value)}
        style={{ width: "100%", padding: 10, borderRadius: 8, marginBottom: 12 }}
      />
      <button
        onClick={handleSearch}
        style={{ padding: 10, borderRadius: 8, marginBottom: 16 }}
      >
        Search
      </button>

      {loading && <div>Loading...</div>}

      {results.length === 0 && !loading && <div>No messages found</div>}

      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {results.map((msg) => (
          <div
            key={msg.id}
            style={{
              padding: 12,
              borderRadius: 10,
              border: "1px solid #ccc",
              cursor: "pointer",
            }}
            onClick={() => openMessage(msg)}
          >
            <div style={{ fontSize: 12, color: "#888", marginBottom: 4 }}>
              Chat: {msg.chatId} | {new Date(msg.createdAt.seconds * 1000).toLocaleString()}
            </div>
            <div style={{ fontSize: 14 }}>
              {highlightText(msg.text || "Media message")}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}