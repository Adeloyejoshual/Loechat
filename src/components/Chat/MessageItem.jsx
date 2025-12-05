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

  // Local UI state (keeps synced with incoming `message` prop)
  const [showModal, setShowModal] = useState(false);
  const [reactedEmoji, setReactedEmoji] = useState(message.reactions?.[myUid] || "");
  const [fadeOut, setFadeOut] = useState(false);
  const [translateX, setTranslateX] = useState(0);
  const [status, setStatus] = useState((message.status || "sent").toLowerCase());
  const [reactionBubbles, setReactionBubbles] = useState([]);
  const [showFullText, setShowFullText] = useState(false);

  // Derived deleted flag from message prop. We keep it derived so remote deletes are respected.
  const deleted = !!message.deleted;

  // Keep local state synced when `message` updates (reactions, status)
  useEffect(() => {
    setReactedEmoji(message.reactions?.[myUid] || "");
  }, [message.reactions, myUid]);

  useEffect(() => {
    setStatus((message.status || "sent").toLowerCase());
  }, [message.status]);

  // Fade-in animation
  useEffect(() => {
    const el = containerRef.current;
    if (el) el.style.opacity = 0;
    const timer = setTimeout(() => {
      if (el) {
        el.style.transition = "opacity 0.3s ease";
        el.style.opacity = 1;
      }
    }, 50);
    return () => clearTimeout(timer);
  }, []);

  // Pin/unpin message
  const togglePin = async () => {
    try {
      const chatRef = doc(db, "chats", chatId);
      const newPin = pinnedMessage?.id !== message.id;
      await updateDoc(chatRef, { pinnedMessageId: newPin ? message.id : null });
      setPinnedMessage(newPin ? message : null);
      toast.success(newPin ? "Message pinned" : "Message unpinned");
    } catch (err) {
      toast.error("Could not update pin: " + (err.message || err));
    }
  };

  // Delete message
  const deleteMessage = async () => {
    if (!window.confirm(`Delete this message for ${isMine ? "everyone" : "them"}?`)) return;

    // If this is a temporary client-side message (e.g. id starts with temp-), don't call Firestore
    if (!message.id || message.id.startsWith("temp-")) {
      // animate out and return (assumes parent will remove temp messages when appropriate)
      setFadeOut(true);
      setTimeout(() => {
        // nothing else to do for temp messages
      }, 300);
      return;
    }

    setFadeOut(true);
    setTimeout(async () => {
      try {
        await updateDoc(doc(db, "chats", chatId, "messages", message.id), { deleted: true });
        toast.success("Message deleted");
      } catch (err) {
        toast.error("Failed to delete message: " + (err.message || err));
        // revert fadeOut on failure
        setFadeOut(false);
      }
    }, 300);
  };

  // Copy message
  const copyMessage = async () => {
    try {
      const textToCopy = message.text || message.mediaUrl || "";
      if (!textToCopy) return toast.info("Nothing to copy");
      await navigator.clipboard.writeText(textToCopy);
      toast.success("Message copied");
    } catch (err) {
      toast.error("Copy failed");
    }
  };

  // Apply reaction (optimistic + rollback on failure)
  const applyReaction = async (emoji) => {
    if (!message.id) return;
    const msgRef = doc(db, "chats", chatId, "messages", message.id);
    const newEmoji = reactedEmoji === emoji ? "" : emoji;

    // optimistic update
    setReactedEmoji(newEmoji);
    if (newEmoji) {
      const bubbleId = Date.now();
      setReactionBubbles((prev) => [...prev, { id: bubbleId, emoji: newEmoji }]);
      setTimeout(() => setReactionBubbles((prev) => prev.filter((b) => b.id !== bubbleId)), 800);
    }

    try {
      await updateDoc(msgRef, { [`reactions.${myUid}`]: newEmoji });
    } catch (err) {
      // rollback
      setReactedEmoji(message.reactions?.[myUid] || "");
      toast.error("Failed to react: " + (err.message || err));
    }
  };

  // Double tap to ❤️
  const handleTap = () => {
    const now = Date.now();
    if (now - lastTap.current < 300) {
      applyReaction("❤️");
      lastTap.current = 0;
    } else {
      lastTap.current = now;
    }
  };

  // Swipe to reply
  const handleTouchStart = (e) => (startX.current = e.touches[0].clientX);
  const handleTouchMove = (e) => {
    const deltaX = e.touches[0].clientX - startX.current;
    // limit to +-100 px
    const clamped = Math.max(-100, Math.min(100, deltaX));
    setTranslateX(clamped);
  };
  const handleTouchEnd = () => {
    if (Math.abs(translateX) > 50) setReplyTo(message);
    setTranslateX(0);
  };

  if (deleted) return null;

  // Render message text
  const renderMessageText = () => {
    if (!message.text) return null;
    if (message.text.length <= READ_MORE_LIMIT) return <div>{message.text}</div>;
    return (
      <div>
        <div
          style={{
            display: "-webkit-box",
            WebkitLineClamp: showFullText ? undefined : 4,
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

  // Media click
  const handleMediaClick = () => {
    if (onOpenMediaViewer && message.mediaUrl) onOpenMediaViewer(message.mediaUrl);
  };

  // Retry upload (delegate to provided retry handler)
  const handleRetry = () => {
    if (message.retry) message.retry();
  };

  // Combine translate values numerically to avoid malformed transform strings
  const fadeOffset = fadeOut ? (isMine ? 100 : -100) : 0;
  const totalTranslate = Math.round((translateX || 0) + fadeOffset);

  // Format time safely (works for Date or Firestore Timestamp)
  const formatTime = (ts) => {
    try {
      const d = ts?.toDate ? ts.toDate() : new Date(ts);
      return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    } catch {
      return "";
    }
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
          transform: `translateX(${totalTranslate}px)`,
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

          {/* Media */}
          {message.mediaUrl && (
            <div style={{ position: "relative", marginBottom: message.text ? 4 : 0 }}>
              {message.mediaType === "image" ? (
                <img
                  src={message.mediaUrl}
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
                  src={message.mediaUrl}
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
          {message.text && renderMessageText()}

          {/* Reactions */}
          <div style={{ position: "relative", marginTop: 4 }}>
            {message.reactions &&
              Object.values(message.reactions)
                .filter(Boolean)
                .map((emoji, i) => (
                  <span
                    key={i}
                    style={{
                      background: COLORS.reactionBg,
                      color: "#fff",
                      padding: "0 6px",
                      borderRadius: 12,
                      fontSize: 12,
                      marginRight: 4,
                    }}
                  >
                    {emoji}
                  </span>
                ))}
            {reactionBubbles.map((b) => (
              <div
                key={b.id}
                style={{
                  position: "absolute",
                  bottom: 0,
                  left: "50%",
                  transform: "translateX(-50%)",
                  animation: "popUp 0.8s forwards",
                  pointerEvents: "none",
                  fontSize: 18,
                }}
              >
                {b.emoji}
              </div>
            ))}
          </div>

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
              {formatTime(message.createdAt)}
              {isMine && status && <> • {status}</>}
            </div>
          )}
        </div>

        {!isMine && typing && <TypingIndicator userName={friendInfo?.name || "Someone"} isDark={isDark} />}

        {/* Long Press Modal */}
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

      <style>{`
        @keyframes popUp {
          0% { transform: translate(-50%, 0) scale(1); opacity: 1; }
          50% { transform: translate(-50%, -20px) scale(1.3); opacity: 1; }
          100% { transform: translate(-50%, -40px) scale(1); opacity: 0; }
        }
      `}</style>
    </>
  );
}