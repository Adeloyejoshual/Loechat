import React, { useState, useRef, useEffect, useContext } from "react";
import { doc, updateDoc } from "firebase/firestore";
import { db } from "../../firebaseConfig";
import { ThemeContext } from "../../context/ThemeContext";
import LongPressMessageModal from "./LongPressMessageModal";
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

const READ_MORE_LIMIT = 150;

export default function MessageItem({
  message,
  myUid,
  isDark,
  chatId,
  setReplyTo,
  pinnedMessage,
  setPinnedMessage,
  onReplyClick,
  friendId,
  onOpenMediaViewer,
  typing = false,
  friendInfo = null,
}) {
  const isMine = message.senderId === myUid;
  const { theme } = useContext(ThemeContext);

  const containerRef = useRef(null);
  const lastTap = useRef(0);
  const startX = useRef(0);

  const [showModal, setShowModal] = useState(false);
  const [reactedEmoji, setReactedEmoji] = useState(message.reactions?.[myUid] || "");
  const [deleted, setDeleted] = useState(false);
  const [fadeOut, setFadeOut] = useState(false);
  const [translateX, setTranslateX] = useState(0);
  const [status, setStatus] = useState(message.status || "Sent");
  const [reactionBubbles, setReactionBubbles] = useState([]);
  const [showFullText, setShowFullText] = useState(false);

  useEffect(() => {
    const el = containerRef.current;
    if (el) el.style.opacity = 0;
    const timer = setTimeout(() => {
      if (el) el.style.transition = "opacity 0.3s ease";
      if (el) el.style.opacity = 1;
    }, 50);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!friendId) return;
    // Optionally: update message status
  }, [friendId, message, isMine]);

  const togglePin = async () => {
    const chatRef = doc(db, "chats", chatId);
    const newPin = pinnedMessage?.id !== message.id;
    await updateDoc(chatRef, { pinnedMessageId: newPin ? message.id : null });
    setPinnedMessage(newPin ? message : null);
    toast.success(newPin ? "Message pinned" : "Message unpinned");
  };

  const deleteMessage = async () => {
    if (!window.confirm(`Delete this message for ${isMine ? "everyone" : "them"}?`)) return;
    setFadeOut(true);
    setTimeout(async () => {
      setDeleted(true);
      await updateDoc(doc(db, "chats", chatId, "messages", message.id), { deleted: true });
    }, 300);
  };

  const copyMessage = async () => {
    await navigator.clipboard.writeText(message.text || message.mediaUrl || "");
    toast.success("Message copied");
  };

  const applyReaction = async (emoji) => {
    const msgRef = doc(db, "chats", chatId, "messages", message.id);
    const newEmoji = reactedEmoji === emoji ? "" : emoji;
    await updateDoc(msgRef, { [`reactions.${myUid}`]: newEmoji });
    setReactedEmoji(newEmoji);

    if (newEmoji) {
      const bubbleId = Date.now();
      setReactionBubbles((prev) => [...prev, { id: bubbleId, emoji: newEmoji }]);
      setTimeout(() => setReactionBubbles((prev) => prev.filter((b) => b.id !== bubbleId)), 800);
    }
  };

  const handleTap = () => {
    const now = Date.now();
    if (now - lastTap.current < 300) {
      applyReaction("❤️");
      lastTap.current = 0;
    } else {
      lastTap.current = now;
    }
  };

  const handleTouchStart = (e) => (startX.current = e.touches[0].clientX);
  const handleTouchMove = (e) => {
    const deltaX = e.touches[0].clientX - startX.current;
    setTranslateX(Math.min(Math.abs(deltaX), 100) * Math.sign(deltaX));
  };
  const handleTouchEnd = () => {
    if (Math.abs(translateX) > 50) setReplyTo(message);
    setTranslateX(0);
  };

  if (deleted) return null;

  const renderMessageText = () => {
    if (!message.text) return null;
    if (message.text.length <= READ_MORE_LIMIT) return <div>{message.text}</div>;
    return (
      <div>
        <div
          className="message-text"
          style={{
            display: "-webkit-box",
            WebkitLineClamp: showFullText ? "none" : 4,
            WebkitBoxOrient: "vertical",
            overflow: "hidden",
            wordBreak: "break-word",
          }}
        >
          {message.text}
        </div>
        {!showFullText && (
          <span
            style={{ color: COLORS.primary, cursor: "pointer", fontWeight: 500, marginLeft: 4 }}
            onClick={() => setShowFullText(true)}
          >
            Read More
          </span>
        )}
      </div>
    );
  };

  const handleMediaClick = () => {
    if (onOpenMediaViewer && message.mediaUrl) onOpenMediaViewer(message.mediaUrl);
  };

  const handleRetry = () => {
    if (message.retry) message.retry();
  };

  return (
    <>
      <div
        ref={containerRef}
        id={message.id}
        className={`message-item ${isMine ? "mine" : "other"}`}
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: isMine ? "flex-end" : "flex-start",
          marginBottom: 8,
          position: "relative",
          transform: `translateX(${translateX}px) ${fadeOut ? `translateX(${isMine ? 100 : -100}px)` : ""}`,
          transition: "transform 0.3s ease, opacity 0.3s ease",
        }}
        onClick={handleTap}
        onContextMenu={(e) => {
          e.preventDefault();
          setShowModal(true);
        }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
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
            display: "inline-block",
            position: "relative",
            boxShadow: "0 1px 3px rgba(0,0,0,0.15)",
            transition: "background 0.2s ease",
          }}
        >
          {/* Media */}
          {message.mediaUrl && (
            <div style={{ position: "relative" }}>
              {message.mediaType === "image" ? (
                <img
                  src={message.mediaUrl || ""}
                  alt="media"
                  style={{
                    maxWidth: "100%",
                    borderRadius: 12,
                    cursor: "pointer",
                    opacity: message.status === "uploading" ? 0.6 : 1,
                  }}
                  onClick={handleMediaClick}
                />
              ) : (
                <video
                  src={message.mediaUrl || ""}
                  controls
                  style={{
                    maxWidth: "100%",
                    borderRadius: 12,
                    cursor: "pointer",
                    opacity: message.status === "uploading" ? 0.6 : 1,
                  }}
                  onClick={handleMediaClick}
                />
              )}

              {message.status === "uploading" && (
                <div
                  style={{
                    position: "absolute",
                    inset: 0,
                    background: "rgba(0,0,0,0.3)",
                    borderRadius: 12,
                    display: "flex",
                    justifyContent: "center",
                    alignItems: "center",
                    color: "#fff",
                    fontSize: 14,
                  }}
                >
                  {Math.round(message.uploadProgress || 0)}%
                </div>
              )}

              {message.status === "failed" && (
                <button
                  onClick={handleRetry}
                  style={{
                    position: "absolute",
                    bottom: 8,
                    right: 8,
                    background: "#ff4d4f",
                    color: "#fff",
                    border: "none",
                    borderRadius: 8,
                    padding: "4px 8px",
                    cursor: "pointer",
                    fontSize: 12,
                  }}
                >
                  Retry
                </button>
              )}
            </div>
          )}

          {/* Text */}
          {!message.mediaUrl && renderMessageText()}

          {/* Timestamp */}
          {message.createdAt && (
            <div
              style={{
                fontSize: 10,
                opacity: 0.6,
                marginTop: 4,
                textAlign: isMine ? "right" : "left",
              }}
            >
              {new Date(message.createdAt.toDate ? message.createdAt.toDate() : message.createdAt).toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
              })}
              {isMine && status && <> • {status}</>}
            </div>
          )}
        </div>

        {!isMine && typing && <TypingIndicator userName={friendInfo?.name || "Someone"} isDark={isDark} />}

        {showModal && (
          <LongPressMessageModal
            onClose={() => setShowModal(false)}
            onReaction={applyReaction}
            onReply={() => setReplyTo(message)}
            onCopy={copyMessage}
            onPin={togglePin}
            onDelete={deleteMessage}
            messageSenderName={isMine ? "you" : "them"}
            isDark={isDark}
          />
        )}
      </div>
    </>
  );
}