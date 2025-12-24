// src/components/Chat/MessageItem.jsx
import React, { useState, useRef, useEffect } from "react";
import { format } from "date-fns";

export default function MessageItem({
  message,
  myUid,
  isDark = false,
  setReplyTo,
  setPinnedMessage,
  onMediaClick,
  registerRef,
  onReact,
  highlight = false,
  dataType,
  dataDate,
  onOpenLongPress,
}) {
  const isMine = message.senderId === myUid;
  const [showReactions, setShowReactions] = useState(false);
  const refEl = useRef(null);

  // Register message DOM for scrolling
  useEffect(() => {
    if (registerRef) registerRef(refEl.current);
  }, [registerRef]);

  const handleLongPress = () => {
    onOpenLongPress?.(message);
  };

  const handleMediaClick = (index = 0) => {
    onMediaClick?.(message, index);
  };

  const formattedTime = message.createdAt
    ? format(new Date(message.createdAt.seconds ? message.createdAt.seconds * 1000 : message.createdAt), "HH:mm")
    : "";

  return (
    <div
      ref={refEl}
      data-type={dataType}
      data-date={dataDate}
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: isMine ? "flex-end" : "flex-start",
        marginBottom: 6,
        animation: highlight ? "flash-highlight 1.2s ease" : "none",
      }}
      onContextMenu={(e) => {
        e.preventDefault();
        handleLongPress();
      }}
    >
      {/* Reply preview */}
      {message.replyTo && (
        <div
          style={{
            fontSize: 12,
            color: isDark ? "#ccc" : "#555",
            marginBottom: 2,
            padding: "2px 6px",
            background: isDark ? "#333" : "#f0f0f0",
            borderRadius: 6,
            maxWidth: "80%",
            cursor: "pointer",
          }}
          onClick={() => setReplyTo?.(message.replyTo)}
        >
          ↩ {message.replyTo.text || "Media message"}
        </div>
      )}

      {/* Message bubble */}
      <div
        style={{
          maxWidth: "80%",
          background: isMine ? "#4a90e2" : isDark ? "#2a2a2a" : "#fff",
          color: isMine ? "#fff" : isDark ? "#eee" : "#111",
          padding: 10,
          borderRadius: 12,
          borderTopLeftRadius: isMine ? 12 : 2,
          borderTopRightRadius: isMine ? 2 : 12,
          wordBreak: "break-word",
          position: "relative",
          cursor: "pointer",
        }}
        onClick={() => setShowReactions((prev) => !prev)}
        onDoubleClick={() => onReact?.(message.id, "❤️")}
      >
        {/* Text */}
        {message.text && <div>{message.text}</div>}

        {/* Media */}
        {message.mediaUrls?.length > 0 &&
          message.mediaUrls.map((url, idx) => (
            <img
              key={idx}
              src={url}
              alt="media"
              style={{
                maxWidth: "100%",
                marginTop: 4,
                borderRadius: 8,
                cursor: "pointer",
              }}
              onClick={() => handleMediaClick(idx)}
            />
          ))}

        {/* Timestamp */}
        <div
          style={{
            fontSize: 10,
            color: isMine ? "rgba(255,255,255,0.7)" : isDark ? "#aaa" : "#555",
            textAlign: "right",
            marginTop: 4,
          }}
        >
          {formattedTime}
        </div>

        {/* Reactions */}
        {message.reactions && Object.keys(message.reactions).length > 0 && (
          <div
            style={{
              display: "flex",
              gap: 4,
              flexWrap: "wrap",
              marginTop: 4,
            }}
          >
            {Object.entries(message.reactions).map(([emoji, users]) => (
              <div
                key={emoji}
                style={{
                  padding: "2px 6px",
                  background: isDark ? "#333" : "#f0f0f0",
                  borderRadius: 8,
                  fontSize: 12,
                  display: "flex",
                  alignItems: "center",
                  gap: 2,
                  cursor: "pointer",
                  border: users.includes(myUid) ? "1px solid #4a90e2" : "none",
                }}
                onClick={() => onReact?.(message.id, emoji)}
              >
                {emoji} {users.length}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}