import React, { useState, useRef, useEffect } from "react";
import LongPressMessageModal from "./LongPressMessageModal";

/**
 * MessageItem
 *
 * Props:
 * - message: the message object
 * - myUid: current user's uid
 * - isDark: theme flag
 * - setReplyTo(message) -> sets reply state in parent
 * - setPinnedMessage(message) -> sets pinned message in parent
 * - friendInfo: friend user object (for long-press labels)
 * - onMediaClick(message) -> open media viewer (parent decides how to locate index)
 * - registerRef(el) -> parent registers DOM node for scroll/highlight
 * - onReact(messageId, emoji) -> optional callback to persist reactions
 * - onDelete(message) -> optional callback
 */

const READ_MORE_STEP = 450; // characters to reveal per "Read more"
const LONG_PRESS_DELAY = 700; // ms
const SWIPE_TRIGGER_DISTANCE = 60; // px

export default function MessageItem({
  message,
  myUid,
  isDark,
  setReplyTo,
  setPinnedMessage,
  friendInfo,
  onMediaClick,
  registerRef,
  onReact,
  onDelete,
}) {
  const isMine = message.senderId === myUid;
  const containerRef = useRef(null);

  // Long-press modal
  const [showLongPress, setShowLongPress] = useState(false);
  const longPressTimer = useRef(null);

  // Read-more
  const [visibleChars, setVisibleChars] = useState(READ_MORE_STEP);
  const isLongText = Boolean(message.text && message.text.length > visibleChars);

  // Swipe
  const swipeStartX = useRef(0);
  const [swipeX, setSwipeX] = useState(0);
  const [swipeActive, setSwipeActive] = useState(false);

  // Double-tap / double-click reaction
  const lastTap = useRef(0);
  const [showQuickReactionAnim, setShowQuickReactionAnim] = useState(false);

  // Local reactions state (renders instantly); prefer parent persistence via onReact
  const [localReactions, setLocalReactions] = useState(message.reactions || {});

  // Keep localReactions in sync when message changes
  useEffect(() => setLocalReactions(message.reactions || {}), [message.reactions]);

  // Register DOM ref with parent (so parent can scroll to it)
  useEffect(() => {
    if (containerRef.current) registerRef?.(containerRef.current);
    // <-- we intentionally DO NOT depend on registerRef to avoid repeated calls
  }, []); // run once

  // ---------------- Long-press detection ----------------
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const startPress = () => {
      longPressTimer.current = setTimeout(() => setShowLongPress(true), LONG_PRESS_DELAY);
    };
    const cancelPress = () => {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    };

    el.addEventListener("mousedown", startPress);
    el.addEventListener("mouseup", cancelPress);
    el.addEventListener("mouseleave", cancelPress);
    el.addEventListener("touchstart", startPress, { passive: true });
    el.addEventListener("touchend", cancelPress);

    return () => {
      cancelPress();
      if (!el) return;
      el.removeEventListener("mousedown", startPress);
      el.removeEventListener("mouseup", cancelPress);
      el.removeEventListener("mouseleave", cancelPress);
      el.removeEventListener("touchstart", startPress);
      el.removeEventListener("touchend", cancelPress);
    };
  }, []);

  // ---------------- Swipe handlers ----------------
  const handleTouchStart = (e) => {
    swipeStartX.current = e.touches[0].clientX;
    setSwipeActive(true);
  };

  const handleTouchMove = (e) => {
    if (!swipeActive) return;
    const diff = e.touches[0].clientX - swipeStartX.current;
    // allow both directions but limit amplitude for UX
    const limited = Math.max(Math.min(diff, 120), -120);
    setSwipeX(limited);
  };

  const handleTouchEnd = () => {
    if (!swipeActive) return;
    // trigger reply when horizontal swipe exceeds threshold either way
    if (Math.abs(swipeX) > SWIPE_TRIGGER_DISTANCE) {
      setReplyTo(message);
    }
    setSwipeX(0);
    setSwipeActive(false);
  };

  // ---------------- Double-tap reaction ----------------
  const handleDoubleTapOrClick = (e) => {
    const now = Date.now();
    const dt = now - lastTap.current;
    lastTap.current = now;

    // double-tap within 300ms
    if (dt > 0 && dt < 350) {
      // quick "like" reaction animation
      setShowQuickReactionAnim(true);
      setTimeout(() => setShowQuickReactionAnim(false), 700);

      // Default emoji (you can change to open a picker)
      const emoji = "❤️";

      // Optimistically update UI
      setLocalReactions((prev) => {
        const users = prev[emoji] ? [...prev[emoji]] : [];
        // toggle for current user: if present remove, else add
        const hasIt = users.includes(myUid);
        const nextUsers = hasIt ? users.filter((u) => u !== myUid) : [...users, myUid];
        return { ...prev, [emoji]: nextUsers };
      });

      // Delegate persistence to parent if provided (e.g. Firestore update)
      onReact?.(message.id, emoji).catch(() => {
        // on failure, revert optimistic change — parent can also handle
        setLocalReactions(message.reactions || {});
      });
    } else {
      // single tap: if there's media, open it; if not, focus/ noop
      if (message.mediaUrl) {
        onMediaClick?.(message);
      }
    }
  };

  // ---------------- Render status (sent / delivered / seen) ----------------
  const renderStatus = () => {
    if (!isMine) return null;
    const total = message.totalParticipants || 2;
    const delivered = message.deliveredTo?.length || 0;
    const seen = message.seenBy?.length || 0;
    if (seen >= total - 1) return "✔✔";
    if (delivered >= total - 1) return "✔✔";
    return "✔";
  };

  // ---------------- Helper: render reply preview content ----------------
  const ReplyPreview = ({ reply }) => {
    if (!reply) return null;
    return (
      <div
        onClick={() => {
          // scroll to original if parent registered
          if (reply.id) {
            const el = document.getElementById(reply.id);
            if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
          }
        }}
        style={{
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          gap: 8,
          fontSize: 12,
          opacity: 0.9,
          paddingLeft: 6,
          marginBottom: 6,
          borderLeft: `3px solid ${isMine ? "#0056b3" : "#4caf50"}`,
        }}
      >
        {reply.mediaUrl ? (
          <img
            src={reply.mediaUrl}
            alt="reply"
            style={{ width: 36, height: 36, borderRadius: 6, objectFit: "cover" }}
          />
        ) : (
          <div style={{ maxWidth: 220, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {reply.text?.slice(0, 80) || "Message"}
          </div>
        )}
      </div>
    );
  };

  // ---------------- UI variables ----------------
  const bubbleBg = isMine ? "#007bff" : isDark ? "#222" : "#fff";
  const bubbleColor = isMine ? "#fff" : isDark ? "#fff" : "#000";

  // show reactions merged from server/local
  const reactionsEntries = Object.entries(localReactions || {});

  return (
    <>
      <div
        id={message.id}
        ref={(el) => {
          containerRef.current = el;
          if (el) registerRef?.(el);
        }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onClick={(e) => {
          e.stopPropagation();
          handleDoubleTapOrClick(e);
        }}
        onDoubleClick={(e) => {
          e.stopPropagation();
          handleDoubleTapOrClick(e);
        }}
        style={{
          alignSelf: isMine ? "flex-end" : "flex-start",
          maxWidth: "78%",
          margin: "6px 0",
          padding: 12,
          borderRadius: 16,
          backgroundColor: bubbleBg,
          color: bubbleColor,
          transform: `translateX(${swipeX}px)`,
          transition: swipeX ? "none" : "transform 0.18s ease",
          wordBreak: "break-word",
          position: "relative",
          boxShadow: isMine ? "0 4px 18px rgba(0,0,0,0.12)" : "0 2px 10px rgba(0,0,0,0.06)",
        }}
      >
        {/* swipe indicator (arrow) */}
        <div
          aria-hidden
          style={{
            position: "absolute",
            left: !isMine ? -36 : undefined,
            right: isMine ? -36 : undefined,
            top: "50%",
            transform: "translateY(-50%)",
            fontSize: 18,
            opacity: Math.min(1, Math.abs(swipeX) / SWIPE_TRIGGER_DISTANCE),
            color: "#4caf50",
            pointerEvents: "none",
          }}
        >
          ↪
        </div>

        {/* reply preview */}
        <ReplyPreview reply={message.replyTo} />

        {/* text */}
        {message.text && (
          <div style={{ whiteSpace: "pre-wrap", lineHeight: 1.4 }}>
            {message.text.slice(0, visibleChars)}
            {isLongText && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setVisibleChars((p) => p + READ_MORE_STEP);
                }}
                style={{
                  marginLeft: 8,
                  background: "transparent",
                  border: "none",
                  color: isMine ? "rgba(255,255,255,0.95)" : "#1976d2",
                  fontWeight: 600,
                  cursor: "pointer",
                }}
                aria-label="Read more"
              >
                Read more
              </button>
            )}
          </div>
        )}

        {/* media */}
        {message.mediaUrl &&
          (message.mediaType === "image" ? (
            <img
              src={message.mediaUrl}
              alt="media"
              onClick={(e) => {
                e.stopPropagation();
                onMediaClick?.(message);
              }}
              style={{
                width: "100%",
                marginTop: message.text ? 8 : 0,
                borderRadius: 12,
                cursor: "pointer",
                display: "block",
              }}
              draggable={false}
            />
          ) : (
            <video
              src={message.mediaUrl}
              controls
              style={{ width: "100%", marginTop: message.text ? 8 : 0, borderRadius: 12 }}
              onClick={(e) => e.stopPropagation()}
            />
          ))}

        {/* reactions row */}
        {reactionsEntries.length > 0 && (
          <div
            style={{
              marginTop: 8,
              display: "flex",
              gap: 6,
              flexWrap: "wrap",
              alignItems: "center",
              animation: "reactionsIn 220ms ease",
            }}
          >
            {reactionsEntries.map(([emoji, users]) => (
              <div
                key={emoji}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "3px 8px",
                  borderRadius: 999,
                  background: isMine ? "rgba(255,255,255,0.12)" : "#f0f0f0",
                  color: isMine ? "#fff" : "#000",
                  fontSize: 14,
                }}
              >
                <span>{emoji}</span>
                {users.length > 1 && <span style={{ fontSize: 12, opacity: 0.85 }}>{users.length}</span>}
              </div>
            ))}
          </div>
        )}

        {/* status */}
        {isMine && (
          <div style={{ fontSize: 11, opacity: 0.75, textAlign: "right", marginTop: 6 }}>
            {renderStatus()}
          </div>
        )}

        {/* quick reaction Lottie-esque small animation */}
        {showQuickReactionAnim && (
          <div
            style={{
              position: "absolute",
              top: -8,
              right: isMine ? 6 : undefined,
              left: isMine ? undefined : 6,
              pointerEvents: "none",
              fontSize: 20,
              transform: "translateY(-6px)",
              transition: "transform 250ms ease, opacity 250ms ease",
            }}
          >
            ❤️
          </div>
        )}
      </div>

      {/* long-press modal */}
      {showLongPress && (
        <LongPressMessageModal
          isDark={isDark}
          onClose={() => setShowLongPress(false)}
          onReply={() => {
            setReplyTo(message);
            setShowLongPress(false);
          }}
          onReaction={(emoji) => {
            // optimistic UI update
            setLocalReactions((prev) => {
              const users = prev[emoji] ? [...prev[emoji]] : [];
              const hasIt = users.includes(myUid);
              const nextUsers = hasIt ? users.filter((u) => u !== myUid) : [...users, myUid];
              return { ...prev, [emoji]: nextUsers };
            });
            onReact?.(message.id, emoji);
            setShowLongPress(false);
          }}
          onCopy={() => {
            navigator.clipboard.writeText(message.text || "");
            setShowLongPress(false);
          }}
          onPin={() => {
            setPinnedMessage(message);
            setShowLongPress(false);
          }}
          onDelete={() => {
            onDelete?.(message);
            setShowLongPress(false);
          }}
          messageSenderName={isMine ? "You" : friendInfo?.name || "User"}
        />
      )}

      <style>{`
        @keyframes reactionsIn {
          from { transform: translateY(6px); opacity: 0 }
          to { transform: translateY(0); opacity: 1 }
        }
      `}</style>
    </>
  );
}