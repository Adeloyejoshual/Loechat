import React, { useState, useEffect, useContext, useRef } from "react";
import { doc, updateDoc } from "firebase/firestore";
import { db } from "../../firebaseConfig";
import { ThemeContext } from "../../context/ThemeContext";
import TypingIndicator from "./TypingIndicator";
import { toast } from "react-toastify";

const COLORS = {
  primary: "#34B7F1",
  lightCard: "#fff",
  darkCard: "#1b1b1b",
  darkText: "#fff",
  mutedText: "#777",
  reactionBg: "rgba(0,0,0,0.7)",
};

export default function MessageItem({
  message,
  myUid,
  isDark,
  chatId,
  setReplyTo,
  onOpenMediaViewer,
  friendInfo,
}) {
  const isMine = message.senderId === myUid;
  const { theme } = useContext(ThemeContext);
  const containerRef = useRef(null);

  const [status, setStatus] = useState((message.status || "sent").toLowerCase());
  const [reactedEmoji, setReactedEmoji] = useState(message.reactions?.[myUid] || "");

  // Sync status and reactions when message updates
  useEffect(() => {
    setStatus((message.status || "sent").toLowerCase());
    setReactedEmoji(message.reactions?.[myUid] || "");
  }, [message]);

  const formatTime = (ts) => {
    try {
      const d = ts?.toDate ? ts.toDate() : new Date(ts);
      return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    } catch {
      return "";
    }
  };

  const handleMediaClick = () => {
    if (onOpenMediaViewer && message.mediaUrl) onOpenMediaViewer(message.mediaUrl);
  };

  const toggleReaction = async (emoji) => {
    if (!message.id) return;
    const msgRef = doc(db, "chats", chatId, "messages", message.id);
    const newEmoji = reactedEmoji === emoji ? "" : emoji;

    // Optimistic update
    setReactedEmoji(newEmoji);

    try {
      await updateDoc(msgRef, { [`reactions.${myUid}`]: newEmoji });
    } catch (err) {
      setReactedEmoji(reactedEmoji);
      toast.error("Failed to react: " + err.message);
    }
  };

  // Skip rendering if deleted
  if (message.deleted) return null;

  return (
    <div
      ref={containerRef}
      className={`message-item ${isMine ? "mine" : "other"}`}
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: isMine ? "flex-end" : "flex-start",
        marginBottom: 8,
      }}
    >
      <div
        className="message-bubble"
        style={{
          maxWidth: "75%",
          padding: 10,
          borderRadius: 18,
          background: isMine ? COLORS.primary : isDark ? COLORS.darkCard : COLORS.lightCard,
          color: isMine ? "#fff" : isDark ? COLORS.darkText : "#000",
          wordBreak: "break-word",
          position: "relative",
          boxShadow: "0 1px 3px rgba(0,0,0,0.15)",
        }}
      >
        {/* Reply Preview */}
        {message.replyTo && (
          <div
            onClick={() => setReplyTo(message.replyTo)}
            style={{
              fontSize: 12,
              opacity: 0.7,
              borderLeft: `2px solid ${COLORS.mutedText}`,
              paddingLeft: 6,
              marginBottom: 4,
              cursor: "pointer",
            }}
          >
            ↪ {message.replyTo?.text?.slice(0, 50) || "Media"}
          </div>
        )}

        {/* Media */}
        {message.mediaUrl && (
          <div style={{ marginBottom: message.text ? 4 : 0, position: "relative" }}>
            {message.mediaType === "image" ? (
              <img
                src={message.mediaUrl}
                alt="media"
                style={{ maxWidth: "100%", borderRadius: 12, cursor: "pointer", opacity: status === "uploading" ? 0.6 : 1 }}
                onClick={handleMediaClick}
              />
            ) : (
              <video
                src={message.mediaUrl}
                controls
                style={{ maxWidth: "100%", borderRadius: 12, cursor: "pointer", opacity: status === "uploading" ? 0.6 : 1 }}
                onClick={handleMediaClick}
              />
            )}
            {status === "uploading" && (
              <div style={{
                position: "absolute",
                inset: 0,
                background: "rgba(0,0,0,0.3)",
                borderRadius: 12,
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
                color: "#fff",
                fontSize: 14,
              }}>
                {Math.round(message.uploadProgress || 0)}%
              </div>
            )}
          </div>
        )}

        {/* Text */}
        {message.text && <div>{message.text}</div>}

        {/* Reactions */}
        <div style={{ marginTop: 4, display: "flex" }}>
          {message.reactions &&
            Object.values(message.reactions).filter(Boolean).map((emoji, i) => (
              <span key={i} style={{ background: COLORS.reactionBg, color: "#fff", padding: "0 6px", borderRadius: 12, fontSize: 12, marginRight: 4 }}>
                {emoji}
              </span>
            ))}
        </div>

        {/* Timestamp */}
        <div style={{ fontSize: 10, opacity: 0.6, marginTop: 4, textAlign: isMine ? "right" : "left" }}>
          {formatTime(message.createdAt)} {isMine && status && <>• {status}</>}
        </div>
      </div>

      {/* Typing indicator for other user */}
      {!isMine && message.typing && <TypingIndicator userName={friendInfo?.name || "Someone"} isDark={isDark} />}
    </div>
  );
}