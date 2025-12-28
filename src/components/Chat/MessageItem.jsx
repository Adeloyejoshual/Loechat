// src/components/Chat/MessageItem.jsx
import React, { useRef, useState } from "react";
import { format } from "date-fns";

export default function MessageItem({
  message,
  myUid,
  isDark,
  pinnedMessage,
  onOpenLongPress,
  onSwipeRight,
  onMediaClick,
  onReactionToggle,
  retryUpload,
  pauseUpload,
  resumeUpload,
  cancelUpload,
}) {
  const isMine = message.senderId === myUid;
  const msgRef = useRef(null);
  const [showFull, setShowFull] = useState(false);

  const touchStartX = useRef(0);
  const touchStartY = useRef(0);
  const longPressTimer = useRef(null);
  const longPressTriggered = useRef(false);

  const LONG_PRESS_DELAY = 550;
  const SWIPE_DISTANCE = 70;
  const MOVE_TOLERANCE = 12;
  const MAX_LENGTH = 200;

  /* ---------------- TOUCH ---------------- */
  const handleTouchStart = (e) => {
    const t = e.touches[0];
    touchStartX.current = t.clientX;
    touchStartY.current = t.clientY;
    longPressTriggered.current = false;

    longPressTimer.current = setTimeout(() => {
      longPressTriggered.current = true;
      onOpenLongPress?.(message, msgRef.current.getBoundingClientRect());
    }, LONG_PRESS_DELAY);
  };
  const handleTouchMove = (e) => {
    const t = e.touches[0];
    const dx = t.clientX - touchStartX.current;
    const dy = t.clientY - touchStartY.current;
    if (Math.abs(dx) > MOVE_TOLERANCE || Math.abs(dy) > MOVE_TOLERANCE) clearTimeout(longPressTimer.current);
  };
  const handleTouchEnd = (e) => {
    clearTimeout(longPressTimer.current);
    if (longPressTriggered.current) return;
    const dx = e.changedTouches[0].clientX - touchStartX.current;
    if (dx > SWIPE_DISTANCE) {
      if (navigator.vibrate) navigator.vibrate(50);
      onSwipeRight?.(message);
    }
  };

  /* ---------------- MOUSE ---------------- */
  const handleMouseDown = () => {
    longPressTriggered.current = false;
    longPressTimer.current = setTimeout(() => {
      longPressTriggered.current = true;
      onOpenLongPress?.(message, msgRef.current.getBoundingClientRect());
    }, LONG_PRESS_DELAY);
  };
  const handleMouseUp = () => clearTimeout(longPressTimer.current);

  /* ---------------- TIME ---------------- */
  const formattedTime = message.createdAt
    ? format(
        new Date(
          message.createdAt.seconds ? message.createdAt.seconds * 1000 : message.createdAt
        ),
        "HH:mm"
      )
    : "";

  /* ---------------- TEXT ---------------- */
  const renderText = () => {
    if (!message.text) return null;
    if (message.text.length <= MAX_LENGTH) return <div>{message.text}</div>;

    return (
      <div>
        {showFull ? message.text : message.text.slice(0, MAX_LENGTH) + "... "}
        <span
          style={{ color: "#4a90e2", cursor: "pointer" }}
          onClick={() => setShowFull(!showFull)}
        >
          {showFull ? "Show less" : "Read more"}
        </span>
      </div>
    );
  };

  /* ---------------- MEDIA ---------------- */
  const renderMedia = () => {
    if (!message.mediaUrl) return null;

    switch (message.mediaType) {
      case "image":
        return (
          <img
            src={message.mediaUrl}
            alt=""
            style={{ width: "100%", borderRadius: 8, marginBottom: 6, cursor: "pointer" }}
            onClick={() => onMediaClick?.(message.id)}
          />
        );
      case "video":
        return (
          <video
            src={message.mediaUrl}
            controls
            style={{ width: "100%", borderRadius: 8, marginBottom: 6 }}
          />
        );
      case "audio":
        return (
          <div style={{ textAlign: "center", marginBottom: 6 }}>
            <audio controls src={message.mediaUrl} style={{ width: "100%" }} />
            <div style={{ fontSize: 12 }}>{message.fileName || "Audio file"}</div>
          </div>
        );
      case "file":
        return (
          <a
            href={message.mediaUrl}
            download={message.fileName || "file"}
            style={{
              display: "block",
              padding: 8,
              background: isDark ? "#333" : "#eee",
              color: isDark ? "#eee" : "#111",
              borderRadius: 6,
              textDecoration: "none",
              marginBottom: 6,
            }}
          >
            📎 {message.fileName || "Download file"}
          </a>
        );
      default:
        return null;
    }
  };

  /* ---------------- UPLOAD STATUS ---------------- */
  const renderUploadStatus = () => {
    if (!message.status || message.status === "done") return null;

    return (
      <div style={{ marginTop: 4 }}>
        {/* Progress bar */}
        <div
          style={{
            height: 4,
            width: "100%",
            background: isDark ? "#555" : "#ccc",
            borderRadius: 2,
            overflow: "hidden",
            marginBottom: 4,
          }}
        >
          <div
            style={{
              height: "100%",
              width: `${message.progress || 0}%`,
              background: "#4a90e2",
              transition: "width 0.2s",
            }}
          />
        </div>

        {/* Controls */}
        {message.status === "uploading" && (
          <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
            <span style={{ fontSize: 10, color: isDark ? "#ccc" : "#555" }}>Uploading...</span>
            <button onClick={() => pauseUpload?.(message)} style={buttonStyle("#f39c12")}>Pause</button>
            <button onClick={() => cancelUpload?.(message)} style={buttonStyle("#e74c3c")}>Cancel</button>
          </div>
        )}
        {message.status === "paused" && (
          <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
            <span style={{ fontSize: 10, color: isDark ? "#ccc" : "#555" }}>Paused</span>
            <button onClick={() => resumeUpload?.(message)} style={buttonStyle("#27ae60")}>Resume</button>
            <button onClick={() => cancelUpload?.(message)} style={buttonStyle("#e74c3c")}>Cancel</button>
          </div>
        )}
        {message.status === "error" && (
          <button onClick={() => retryUpload([message], message.replyTo)} style={buttonStyle("#e74c3c")}>Retry</button>
        )}
      </div>
    );
  };

  const buttonStyle = (bg) => ({
    fontSize: 10,
    padding: "2px 6px",
    cursor: "pointer",
    border: "none",
    borderRadius: 4,
    background: bg,
    color: "#fff",
  });

  /* ---------------- RENDER ---------------- */
  return (
    <div
      id={message.id}
      ref={msgRef}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onMouseDown={handleMouseDown}
      onMouseUp={handleMouseUp}
      onContextMenu={(e) => {
        e.preventDefault();
        onOpenLongPress?.(message, msgRef.current.getBoundingClientRect());
      }}
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: isMine ? "flex-end" : "flex-start",
        marginBottom: 8,
        touchAction: "pan-y",
      }}
    >
      <div
        style={{
          maxWidth: "80%",
          padding: 10,
          borderRadius: 12,
          background: isMine ? "#4a90e2" : isDark ? "#2a2a2a" : "#fff",
          color: isMine ? "#fff" : isDark ? "#eee" : "#111",
          position: "relative",
        }}
      >
        {renderMedia()}
        {renderText()}
        {renderUploadStatus()}
        <div style={{ fontSize: 10, textAlign: "right", opacity: 0.7, marginTop: 4 }}>
          {formattedTime}
        </div>
        {pinnedMessage?.id === message.id && (
          <div style={{ position: "absolute", top: -8, right: -8, fontSize: 12 }}>📌</div>
        )}
      </div>

      {message.reactions && Object.keys(message.reactions).length > 0 && (
        <div
          style={{
            display: "flex",
            gap: 6,
            marginTop: 4,
            flexWrap: "wrap",
            alignSelf: isMine ? "flex-end" : "flex-start",
          }}
        >
          {Object.entries(message.reactions).map(([emoji, users]) => {
            const reacted = users.includes(myUid);
            return (
              <button
                key={emoji}
                onClick={() => onReactionToggle?.(message, emoji)}
                style={{
                  padding: "3px 8px",
                  borderRadius: 12,
                  border: "none",
                  cursor: "pointer",
                  background: reacted ? "#4a90e2" : isDark ? "#333" : "#eee",
                  color: reacted ? "#fff" : isDark ? "#eee" : "#111",
                  fontSize: 12,
                }}
              >
                {emoji} {users.length}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}