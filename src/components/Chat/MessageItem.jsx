import React, { useState, useRef, useContext } from "react";
import { doc, updateDoc } from "firebase/firestore";
import { db } from "../../firebaseConfig";
import { ThemeContext } from "../../context/ThemeContext";
import LongPressMessageModal from "./LongPressMessageModal";
import MediaViewer from "./MediaViewer";
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
  pinnedMessage,
  setPinnedMessage,
  onReplyClick,
  isBlockedUser,
}) {
  const isMine = message.senderId === myUid;
  const { theme } = useContext(ThemeContext);

  const containerRef = useRef(null);
  const lastTap = useRef(0);
  const startX = useRef(0);

  const [showModal, setShowModal] = useState(false);
  const [reactedEmoji, setReactedEmoji] = useState(message.reactions?.[myUid] || "");
  const [deleted, setDeleted] = useState(false);
  const [showMediaViewer, setShowMediaViewer] = useState(false);
  const [translateX, setTranslateX] = useState(0);

  // ---------------- Firestore actions ----------------
  const togglePin = async () => {
    if (isBlockedUser) return toast.error("Cannot pin messages while blocked");
    const chatRef = doc(db, "chats", chatId);
    const newPin = pinnedMessage?.id !== message.id;
    await updateDoc(chatRef, { pinnedMessageId: newPin ? message.id : null });
    setPinnedMessage(newPin ? message : null);
    toast.success(newPin ? "Message pinned" : "Message unpinned");
  };

  const deleteMessage = async () => {
    if (isBlockedUser) return toast.error("Cannot delete while blocked");
    if (!window.confirm(`Delete this message for ${isMine ? "everyone" : "them"}?`)) return;
    setDeleted(true); // fade-out animation
    await updateDoc(doc(db, "chats", chatId, "messages", message.id), { deleted: true });
    toast.success("Message deleted for everyone");
  };

  const copyMessage = async () => {
    await navigator.clipboard.writeText(message.text || message.mediaUrl || "");
    toast.success("Copied!");
  };

  const applyReaction = async (emoji) => {
    if (isBlockedUser) return toast.error("Cannot react while blocked");
    const msgRef = doc(db, "chats", chatId, "messages", message.id);
    const newEmoji = reactedEmoji === emoji ? "" : emoji;
    await updateDoc(msgRef, { [`reactions.${myUid}`]: newEmoji });
    setReactedEmoji(newEmoji);
    toast.success(newEmoji ? `Reacted ${newEmoji}` : "Reaction removed");
  };

  // ---------------- Double tap for ❤️ ----------------
  const handleTap = () => {
    const now = Date.now();
    if (now - lastTap.current < 300) {
      applyReaction("❤️");
      lastTap.current = 0;
    } else {
      lastTap.current = now;
    }
  };

  // ---------------- Long press modal ----------------
  const handleLongPress = () => {
    if (isBlockedUser) return toast.error("Blocked users cannot edit messages");
    setShowModal(true);
  };

  // ---------------- Swipe-to-reply ----------------
  const handleTouchStart = (e) => {
    startX.current = e.touches[0].clientX;
  };

  const handleTouchMove = (e) => {
    const deltaX = e.touches[0].clientX - startX.current;
    if (!isMine && deltaX > 0) setTranslateX(Math.min(deltaX, 100));
  };

  const handleTouchEnd = () => {
    if (translateX > 50) {
      setReplyTo(message);
      toast.info("Replying…");
    }
    setTranslateX(0);
  };

  if (deleted) return null;

  return (
    <>
      <div
        ref={containerRef}
        className={`message-item ${isMine ? "mine" : "other"}`}
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: isMine ? "flex-end" : "flex-start",
          marginBottom: 8,
          position: "relative",
          transform: `translateX(${translateX}px)`,
          transition: translateX === 0 ? "transform 0.2s ease" : "none",
        }}
        onClick={handleTap}
        onContextMenu={(e) => { e.preventDefault(); handleLongPress(); }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {/* Message Bubble */}
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
          }}
        >
          {/* Tail */}
          <div
            style={{
              position: "absolute",
              bottom: 0,
              width: 0,
              height: 0,
              borderStyle: "solid",
              borderWidth: "6px 6px 0 0",
              borderColor: isMine
                ? `${COLORS.primary} transparent transparent transparent`
                : `${isDark ? COLORS.darkCard : COLORS.lightCard} transparent transparent transparent`,
              right: isMine ? -6 : "auto",
              left: isMine ? "auto" : -6,
            }}
          />

          {/* Reply Preview */}
          {message.replyTo && (
            <div
              onClick={() => onReplyClick?.(message.replyTo?.id)}
              style={{
                fontSize: 12,
                opacity: 0.7,
                borderLeft: `2px solid ${COLORS.mutedText}`,
                paddingLeft: 6,
                marginBottom: 4,
                cursor: "pointer",
              }}
            >
              ↪ {message.replyTo?.text?.slice(0, 50)}
            </div>
          )}

          {/* Text */}
          {message.text && <div>{message.text}</div>}

          {/* Media */}
          {message.mediaUrl && (
            <img
              src={message.mediaUrl}
              alt="media"
              style={{ maxWidth: "100%", borderRadius: 12, marginTop: 6, cursor: "pointer" }}
              onClick={() => setShowMediaViewer(true)}
            />
          )}

          {/* Reactions */}
          {message.reactions && Object.values(message.reactions).filter(Boolean).length > 0 && (
            <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
              {Object.entries(message.reactions)
                .filter(([_, v]) => v)
                .map(([uid, emoji], i) => (
                  <span
                    key={i}
                    style={{
                      background: COLORS.reactionBg,
                      color: "#fff",
                      padding: "0 6px",
                      borderRadius: 12,
                      fontSize: 12,
                    }}
                  >
                    {emoji}
                  </span>
                ))}
            </div>
          )}

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
            </div>
          )}
        </div>
      </div>

      {/* Long Press Modal */}
      {showModal && (
        <LongPressMessageModal
          onClose={() => setShowModal(false)}
          onReaction={applyReaction}
          onReply={() => { setReplyTo(message); setShowModal(false); toast.info("Replying…"); }}
          onCopy={copyMessage}
          onPin={togglePin}
          onDelete={deleteMessage}
          messageSenderName={isMine ? "you" : "them"}
          isDark={isDark}
        />
      )}

      {/* Media Viewer */}
      {showMediaViewer && (
        <MediaViewer
          url={message.mediaUrl}
          type={message.mediaType || "image"}
          onClose={() => setShowMediaViewer(false)}
        />
      )}
    </>
  );
}