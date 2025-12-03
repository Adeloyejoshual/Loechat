// src/components/Chat/ChatConversationPage.jsx
import React, { useEffect, useState, useRef, useContext } from "react";
import { useParams } from "react-router-dom";
import {
  collection,
  addDoc,
  query,
  orderBy,
  onSnapshot,
  serverTimestamp,
  doc,
  updateDoc,
} from "firebase/firestore";
import { db, auth } from "../../firebaseConfig";
import MessageItem from "./MessageItem";
import ChatInput from "./ChatInput";
import TypingIndicator from "./TypingIndicator";

export default function ChatConversationPage() {
  const { id: chatId } = useParams();
  const currentUser = auth.currentUser;

  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [replyTo, setReplyTo] = useState(null);
  const [isTyping, setIsTyping] = useState(false);

  const [showScrollButton, setShowScrollButton] = useState(false);

  const messagesEndRef = useRef(null);
  const scrollContainerRef = useRef(null);

  const isDark = false; // attach your theme later

  // -----------------------------
  // LISTEN FOR MESSAGES
  ------------------------------
  useEffect(() => {
    const q = query(
      collection(db, "chats", chatId, "messages"),
      orderBy("createdAt", "asc")
    );

    const unsub = onSnapshot(q, (snap) => {
      const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setMessages(list);

      if (isAtBottom()) {
        scrollToBottom();
      }
    });

    return () => unsub();
  }, [chatId]);

  // -----------------------------
  // Detect Scroll Position
  ------------------------------
  const isAtBottom = () => {
    const el = scrollContainerRef.current;
    if (!el) return false;
    return el.scrollHeight - el.scrollTop - el.clientHeight < 50;
  };

  const handleScroll = () => {
    if (!scrollContainerRef.current) return;

    if (isAtBottom()) {
      setShowScrollButton(false);
    } else {
      setShowScrollButton(true);
    }
  };

  const scrollToBottom = () => {
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, 50);
  };

  // -----------------------------
  // Send Text Message
  ------------------------------
  const sendTextMessage = async () => {
    if (!text.trim() && selectedFiles.length === 0) return;

    await addDoc(collection(db, "chats", chatId, "messages"), {
      sender: currentUser.uid,
      text: text.trim(),
      media: [],
      replyTo: replyTo || null,
      createdAt: serverTimestamp(),
    });

    setText("");
    setReplyTo(null);
    scrollToBottom();
  };

  // -----------------------------
  // TYPING INDICATOR
  ------------------------------
  const handleTyping = async (value) => {
    setText(value);

    const ref = doc(db, "chats", chatId);
    updateDoc(ref, { [`typing.${currentUser.uid}`]: value.length > 0 });

    setTimeout(() => {
      updateDoc(ref, { [`typing.${currentUser.uid}`]: false });
    }, 2000);
  };

  // -----------------------------
  // FORMAT DATE GROUPING
  ------------------------------
  const formatDateBar = (date) => {
    const d = new Date(date);
    const today = new Date();
    const yesterday = new Date(Date.now() - 86400000);

    if (d.toDateString() === today.toDateString()) return "Today";
    if (d.toDateString() === yesterday.toDateString()) return "Yesterday";

    return d.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });
  };

  let lastDate = "";

  return (
    <div
      style={{
        height: "100vh",
        display: "flex",
        flexDirection: "column",
        background: isDark ? "#0d0d0d" : "#f6f7f9",
      }}
    >
      {/* Messages Area */}
      <div
        ref={scrollContainerRef}
        onScroll={handleScroll}
        style={{
          flex: 1,
          overflowY: "auto",
          padding: "10px 12px 90px",
        }}
      >
        {messages.map((msg, idx) => {
          const dateBar = formatDateBar(msg.createdAt?.toDate());
          const showDate = dateBar !== lastDate;
          if (showDate) lastDate = dateBar;

          return (
            <React.Fragment key={msg.id}>
              {/* DATE SEPARATOR */}
              {showDate && (
                <div
                  style={{
                    alignSelf: "center",
                    textAlign: "center",
                    background: isDark ? "#2e2e2e" : "#dfe5ea",
                    color: isDark ? "#fff" : "#000",
                    padding: "4px 10px",
                    borderRadius: 12,
                    fontSize: 12,
                    margin: "10px auto",
                    width: "fit-content",
                  }}
                >
                  {dateBar}
                </div>
              )}

              <MessageItem
                message={msg}
                isDark={isDark}
                setReplyTo={setReplyTo}
              />
            </React.Fragment>
          );
        })}

        {isTyping && <TypingIndicator />}

        <div ref={messagesEndRef} />
      </div>

      {/* Scroll-To-Bottom Arrow */}
      {showScrollButton && (
        <button
          onClick={scrollToBottom}
          style={{
            position: "absolute",
            bottom: 90,
            right: 20,
            background: "#0084ff",
            color: "white",
            padding: 10,
            borderRadius: "50%",
            border: "none",
            cursor: "pointer",
            boxShadow: "0 3px 6px rgba(0,0,0,0.2)",
          }}
        >
          ▼
        </button>
      )}

      {/* Input */}
      <ChatInput
        text={text}
        setText={(v) => {
          handleTyping(v);
        }}
        sendTextMessage={sendTextMessage}
        selectedFiles={selectedFiles}
        setSelectedFiles={setSelectedFiles}
        isDark={isDark}
        chatId={chatId}
        replyTo={replyTo}
        setReplyTo={setReplyTo}
      />
    </div>
  );
}