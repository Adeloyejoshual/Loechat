// src/components/Chat/ImagePreviewModal.jsx
import React from "react";

const SPACING = { xs: 4, sm: 8, md: 12, lg: 14, xl: 20, borderRadius: 12 };
const COLORS = {
  lightCard: "#fff",
  darkCard: "#1b1b1b",
  darkText: "#fff",
  lightText: "#000",
  grayBorder: "rgba(0,0,0,0.06)",
};

export default function ImagePreviewModal({
  previews = [],
  currentIndex = 0,
  onClose = () => {},
  onNext = () => {},
  onPrev = () => {},
  onRemove = () => {},
  isDark = false,
}) {
  if (!previews.length) return null;

  const current = previews[currentIndex];

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        width: "100vw",
        height: "100vh",
        backgroundColor: "rgba(0,0,0,0.8)",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        zIndex: 1000,
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          position: "relative",
          maxWidth: "90%",
          maxHeight: "90%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
        }}
      >
        {/* Media */}
        {current?.type === "image" && (
          <img
            src={current.url}
            alt={current.name}
            style={{ maxHeight: "80vh", maxWidth: "80vw", borderRadius: SPACING.borderRadius }}
          />
        )}
        {current?.type === "video" && (
          <video
            src={current.url}
            controls
            style={{ maxHeight: "80vh", maxWidth: "80vw", borderRadius: SPACING.borderRadius }}
          />
        )}

        {/* Navigation */}
        {previews.length > 1 && (
          <>
            <button
              onClick={onPrev}
              style={{
                position: "absolute",
                left: 0,
                top: "50%",
                transform: "translateY(-50%)",
                background: "rgba(0,0,0,0.5)",
                border: "none",
                color: "#fff",
                fontSize: 24,
                padding: "8px",
                cursor: "pointer",
              }}
            >
              ‹
            </button>
            <button
              onClick={onNext}
              style={{
                position: "absolute",
                right: 0,
                top: "50%",
                transform: "translateY(-50%)",
                background: "rgba(0,0,0,0.5)",
                border: "none",
                color: "#fff",
                fontSize: 24,
                padding: "8px",
                cursor: "pointer",
              }}
            >
              ›
            </button>
          </>
        )}

        {/* Footer actions */}
        <div
          style={{
            marginTop: 12,
            display: "flex",
            gap: 12,
            justifyContent: "center",
            width: "100%",
          }}
        >
          <button
            onClick={onRemove}
            style={{
              padding: SPACING.sm,
              borderRadius: SPACING.borderRadius,
              border: `1px solid ${COLORS.grayBorder}`,
              background: isDark ? COLORS.darkCard : COLORS.lightCard,
              color: isDark ? COLORS.darkText : COLORS.lightText,
              cursor: "pointer",
            }}
          >
            Remove
          </button>
          <button
            onClick={onClose}
            style={{
              padding: SPACING.sm,
              borderRadius: SPACING.borderRadius,
              border: `1px solid ${COLORS.grayBorder}`,
              background: isDark ? COLORS.darkCard : COLORS.lightCard,
              color: isDark ? COLORS.darkText : COLORS.lightText,
              cursor: "pointer",
            }}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}