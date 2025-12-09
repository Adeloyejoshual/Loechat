// src/components/ChatConversationPage.jsx
import React, {
  useEffect,
  useState,
  useRef,
  useContext,
  useCallback,
  useMemo,
} from "react";
import { useParams } from "react-router-dom";
import {
  collection,
  addDoc,
  doc,
  updateDoc,
  onSnapshot,
  arrayUnion,
  arrayRemove,
  serverTimestamp,
  getDoc,
  orderBy,
  query,
  getDocs,
} from "firebase/firestore";
import { db, auth } from "../firebaseConfig";
import { ThemeContext } from "../context/ThemeContext";
import { UserContext } from "../context/UserContext";

import ChatHeader from "./Chat/ChatHeader";
import MessageItem from "./Chat/MessageItem";
import ChatInput from "./Chat/ChatInput";
import ImagePreviewModal from "./Chat/ImagePreviewModal";
import MediaViewer from "./Chat/MediaViewer";
import LongPressMessageModal from "./Chat/LongPressMessageModal";
import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import axios from "axios";

/**
 * ChatConversationPage
 *
 * - Messages are shown oldest -> newest
 * - Auto-scrolls to bottom on open and when new messages arrive (only if user is at bottom)
 * - sendTextHandler / sendMediaHandler clear the input immediately to avoid "message shows but input remains" bug
 */

export default function ChatConversationPage() {
  const { chatId } = useParams();
  const { theme, wallpaper } = useContext(ThemeContext);
  const { currentUser } = useContext(UserContext);
  const isDark = theme === "dark";
  const myUid = auth.currentUser?.uid || currentUser?.uid;

  const messagesRefEl = useRef(null);
  const endRef = useRef(null);
  const messageRefs = useRef({});
  const typingTimer = useRef(null);

  const [chatInfo, setChatInfo] = useState(null);
  const [friendInfo, setFriendInfo] = useState(null);
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [caption, setCaption] = useState("");
  const [replyTo, setReplyTo] = useState(null);
  const [pinnedMessage, setPinnedMessage] = useState(null);
  const [isBlocked, setIsBlocked] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [mediaViewer, setMediaViewer] = useState({ open: false, startIndex: 0 });
  const [friendTyping, setFriendTyping] = useState(false);
  const [isAtBottom, setIsAtBottom] = useState(true);

  // Global modals
  const [longPressMessage, setLongPressMessage] = useState(null);

  // -------- Chat & Friend subscription --------
  useEffect(() => {
    if (!chatId) return;
    const chatRef = doc(db, "chats", chatId);
    const unsubList = [];

    const unsubChat = onSnapshot(chatRef, (snap) => {
      if (!snap.exists()) return;
      const data = snap.data();
      setChatInfo({ id: snap.id, ...data });
      setIsBlocked(Boolean(data.blocked));
      setIsMuted(data.mutedUntil && data.mutedUntil > Date.now());

      const friendId = (data.participants || []).find((p) => p !== myUid);
      if (friendId) {
        const userRef = doc(db, "users", friendId);
        const unsubFriend = onSnapshot(userRef, (s) =>
          s.exists() && setFriendInfo({ id: s.id, ...s.data() })
        );
        unsubList.push(unsubFriend);
      } else setFriendInfo(null);

      // pinned message
      if (data.pinnedMessageId) {
        const pinnedRef = doc(db, "chats", chatId, "messages", data.pinnedMessageId);
        const unsubPinned = onSnapshot(pinnedRef, (s) =>
          s.exists() && setPinnedMessage({ id: s.id, ...s.data() })
        );
        unsubList.push(unsubPinned);
      } else setPinnedMessage(null);

      // typing indicator
      const friendIdForTyping = (data.participants || []).find((p) => p !== myUid);
      setFriendTyping(Boolean(data.typing?.[friendIdForTyping]));
    });

    unsubList.push(unsubChat);
    return () => unsubList.forEach((u) => u());
  }, [chatId, myUid]);

  // -------- Real-time messages (old -> new) --------
  useEffect(() => {
    if (!chatId) return;
    const messagesRef = collection(db, "chats", chatId, "messages");
    const q = query(messagesRef, orderBy("createdAt", "asc")); // oldest → newest

    const unsub = onSnapshot(q, (snap) => {
      const docs = snap.docs.map((d) => ({
        id: d.id,
        ...d.data(),
        createdAt: d.data().createdAt?.toDate?.() || new Date(),
      }));
      setMessages(docs);

      // mark delivered for messages that are not from me
      docs
        .filter((m) => m.senderId !== myUid && !(m.deliveredTo || []).includes(myUid))
        .forEach((m) =>
          updateDoc(doc(db, "chats", chatId, "messages", m.id), {
            deliveredTo: arrayUnion(myUid),
          }).catch(() => {})
        );

      // If user is at bottom, ensure we stay scrolled to bottom
      if (isAtBottom) {
        // small timeout to allow DOM update
        setTimeout(() => endRef.current?.scrollIntoView({ behavior: "auto" }), 60);
      }
    });

    return () => unsub();
  }, [chatId, myUid, isAtBottom]);

  // -------- Mark seen when messages change --------
  useEffect(() => {
    if (!chatId || !myUid || !messages.length) return;
    const unseen = messages.filter(
      (m) => m.senderId !== myUid && !(m.seenBy || []).includes(myUid)
    );
    unseen.forEach((m) =>
      updateDoc(doc(db, "chats", chatId, "messages", m.id), {
        seenBy: arrayUnion(myUid),
      }).catch(() => {})
    );
    updateDoc(doc(db, "chats", chatId), { [`lastSeen.${myUid}`]: serverTimestamp() }).catch(() => {});
  }, [messages, chatId, myUid]);

  // -------- Scroll detection (user scrolled away?) --------
  useEffect(() => {
    const el = messagesRefEl.current;
    if (!el) return;
    const onScroll = () => {
      const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
      setIsAtBottom(atBottom);
    };
    el.addEventListener("scroll", onScroll);
    return () => el.removeEventListener("scroll", onScroll);
  }, []);

  // -------- Typing flag helpers --------
  const setTypingFlag = useCallback(
    async (typing) => {
      if (!chatId || !myUid) return;
      try {
        await updateDoc(doc(db, "chats", chatId), { [`typing.${myUid}`]: typing });
      } catch (e) {
        // ignore typing write failures
      }
    },
    [chatId, myUid]
  );

  const handleUserTyping = useCallback(
    (isTyping) => {
      if (isTyping) {
        setTypingFlag(true);
        typingTimer.current && clearTimeout(typingTimer.current);
        typingTimer.current = setTimeout(() => setTypingFlag(false), 1800);
      } else {
        setTypingFlag(false);
        typingTimer.current && clearTimeout(typingTimer.current);
      }
    },
    [setTypingFlag]
  );

  // -------- Reaction toggle helper (used by MessageItem and LongPress modal) --------
  const handleReact = useCallback(
    async (messageId, emoji) => {
      if (!chatId || !messageId || !myUid) return;
      const msgRef = doc(db, "chats", chatId, "messages", messageId);
      try {
        const snap = await getDoc(msgRef);
        const data = snap.data();
        const userReacted = data?.reactions?.[emoji]?.includes(myUid);
        await updateDoc(msgRef, {
          [`reactions.${emoji}`]: userReacted ? arrayRemove(myUid) : arrayUnion(myUid),
        });
      } catch (err) {
        console.error("React failed", err);
      }
    },
    [chatId, myUid]
  );

  // -------- Send message (core) --------
  // Note: this function does NOT clear the ChatInput — we wrap it with handlers below.
  const sendMessage = useCallback(
    async (textMsg = "", files = []) => {
      if (isBlocked) {
        toast.error("You cannot send messages to this user");
        return;
      }
      if (!textMsg && files.length === 0) return;

      if (isMuted) toast.info("This chat is muted. You won't receive notifications.");

      const messagesCol = collection(db, "chats", chatId, "messages");
      const tempId = `temp-${Date.now()}-${Math.random()}`;
      const tempMessage = {
        id: tempId,
        senderId: myUid,
        text: textMsg?.trim() || "",
        mediaUrls: files.map((f) => (typeof f === "string" ? f : URL.createObjectURL(f))),
        createdAt: new Date(),
        reactions: {},
        seenBy: [],
        deliveredTo: [],
        replyTo: replyTo ? { id: replyTo.id, text: replyTo.text, senderId: replyTo.senderId } : null,
        status: "sending",
        uploadProgress: 0,
      };

      // optimistic UI
      setMessages((prev) => [...prev, tempMessage]);
      if (isAtBottom) {
        setTimeout(() => endRef.current?.scrollIntoView({ behavior: "smooth" }), 40);
      }

      try {
        // if files present, upload to Cloudinary
        const uploadedUrls = [];
        for (const file of files) {
          // if file is string (already url), just push it
          if (typeof file === "string") {
            uploadedUrls.push(file);
            continue;
          }
          const formData = new FormData();
          formData.append("file", file);
          formData.append("upload_preset", import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET);
          const res = await axios.post(
            `https://api.cloudinary.com/v1_1/${import.meta.env.VITE_CLOUDINARY_CLOUD_NAME}/auto/upload`,
            formData,
            {
              onUploadProgress: (ev) => {
                const pct = Math.round((ev.loaded * 100) / ev.total);
                setMessages((prev) => prev.map((m) => (m.id === tempId ? { ...m, uploadProgress: pct } : m)));
              },
            }
          );
          uploadedUrls.push(res.data.secure_url);
        }

        const payload = {
          ...tempMessage,
          mediaUrls: uploadedUrls,
          createdAt: serverTimestamp(),
          status: "sent",
        };

        const docRef = await addDoc(messagesCol, payload);

        // replace temp message with actual persisted message id
        setMessages((prev) => prev.map((m) => (m.id === tempId ? { ...payload, id: docRef.id, createdAt: new Date() } : m)));

        // update chat doc last message
        await updateDoc(doc(db, "chats", chatId), {
          lastMessage: textMsg || (files[0]?.name || "Media"),
          lastMessageSender: myUid,
          lastMessageAt: serverTimestamp(),
          lastMessageStatus: "delivered",
        });
      } catch (err) {
        console.error("Send message failed:", err);
        toast.error("Failed to send message");
        setMessages((prev) => prev.map((m) => (m.id === tempId ? { ...m, status: "failed" } : m)));
      } finally {
        // cleanup handled by callers (wrappers) — we still clear preview state here
        setShowPreview(false);
      }
    },
    [chatId, myUid, isBlocked, isAtBottom, replyTo, isMuted]
  );

  // -------- Wrappers passed to ChatInput so input is cleared immediately --------
  const sendTextHandler = (messageText) => {
    const t = messageText || text;
    if (!t || !t.trim()) return;
    // clear input first so UI doesn't show old text
    setText("");
    setReplyTo(null);
    sendMessage(t, []);
  };

  const sendMediaHandler = (files) => {
    // clear selection and preview immediately
    setSelectedFiles([]);
    setCaption("");
    setShowPreview(false);
    setReplyTo(null);
    // send with current caption
    sendMessage(caption, files);
  };

  // -------- Media items for MediaViewer (flat list) --------
  const mediaItems = useMemo(
    () =>
      messages
        .filter((m) => m.mediaUrls?.length)
        .flatMap((m) => m.mediaUrls.map((url) => ({ url, id: m.id }))),
    [messages]
  );

  const openMediaViewerAtMessage = useCallback(
    (message) => {
      const index = mediaItems.findIndex((m) => m.id === message.id);
      setMediaViewer({ open: true, startIndex: index >= 0 ? index : 0 });
    },
    [mediaItems]
  );

  // -------- Scroll to message helper --------
  const scrollToMessage = useCallback((id) => {
    const el = messageRefs.current[id];
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      el.classList.add("flash-highlight");
      setTimeout(() => el.classList.remove("flash-highlight"), 1200);
    }
  }, []);

  // -------- Delete helpers (global modal) --------
  const handleDeleteForMe = (message) => {
    setMessages((prev) => prev.filter((m) => m.id !== message.id));
    toast.info("Message deleted for you");
    if (pinnedMessage?.id === message.id) setPinnedMessage(null);
  };

  const handleDeleteForEveryone = async (message) => {
    await updateDoc(doc(db, "chats", chatId, "messages", message.id), { deleted: true });
    setMessages((prev) => prev.filter((m) => m.id !== message.id));
    toast.success("Message deleted for everyone");
    if (pinnedMessage?.id === message.id) setPinnedMessage(null);
  };

  // -------- mount: scroll to bottom initially --------
  useEffect(() => {
    // small delay so DOM rendered
    setTimeout(() => endRef.current?.scrollIntoView({ behavior: "auto" }), 80);
  }, [chatId]);

  // -------- Render --------
  if (!chatInfo || !friendInfo) return <div style={{ padding: 20 }}>Loading chat...</div>;

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100vh",
        backgroundColor: wallpaper || (isDark ? "#0b0b0b" : "#f5f5f5"),
        color: isDark ? "#fff" : "#000",
        position: "relative",
      }}
    >
      <ChatHeader
        friendId={friendInfo.id}
        chatId={chatId}
        pinnedMessage={pinnedMessage}
        setBlockedStatus={setIsBlocked}
        onGoToPinned={() => pinnedMessage && scrollToMessage(pinnedMessage.id)}
        onSearch={() => toast.info("Search triggered")}
        onClearChat={async () => {
          const confirmed = window.confirm("Clear all messages?");
          if (!confirmed) return;
          // mark messages deleted (safer than hard delete)
          const msgsRef = collection(db, "chats", chatId, "messages");
          const snap = await getDocs(msgsRef);
          await Promise.all(
            snap.docs.map((m) => updateDoc(doc(db, "chats", chatId, "messages", m.id), { deleted: true }))
          );
          setMessages([]);
          toast.success("Chat cleared");
        }}
        onVoiceCall={() => toast.info("Voice call started")}
        onVideoCall={() => toast.info("Video call started")}
      />

      <div
        ref={messagesRefEl}
        style={{ flex: 1, overflowY: "auto", padding: 8, display: "flex", flexDirection: "column" }}
      >
        {messages.map((msg) => (
          <MessageItem
            key={msg.id}
            message={msg}
            myUid={myUid}
            isDark={isDark}
            setReplyTo={setReplyTo}
            setPinnedMessage={(m) => {
              if (!m?.id) return;
              updateDoc(doc(db, "chats", chatId), { pinnedMessageId: m.id }).catch(console.error);
              setPinnedMessage(m);
            }}
            onMediaClick={openMediaViewerAtMessage}
            registerRef={(el) => {
              if (el) messageRefs.current[msg.id] = el;
              else delete messageRefs.current[msg.id];
            }}
            onReact={handleReact}
            onDeleteForMe={handleDeleteForMe}
            onDeleteForEveryone={handleDeleteForEveryone}
            onOpenLongPress={(m) => setLongPressMessage(m)}
            onOpenEmojiPicker={() => setLongPressMessage(null)}
            isLongPressOpen={longPressMessage?.id === msg.id}
          />
        ))}

        <div ref={endRef} />
      </div>

      {friendTyping && (
        <div style={{ padding: "0 12px 6px 12px", fontSize: 12, color: isDark ? "#ccc" : "#555" }}>
          {friendInfo?.name || "Contact"} is typing...
        </div>
      )}

      <ChatInput
        text={text}
        setText={setText}
        selectedFiles={selectedFiles}
        setSelectedFiles={setSelectedFiles}
        setShowPreview={setShowPreview}
        isDark={isDark}
        replyTo={replyTo}
        setReplyTo={setReplyTo}
        sendTextMessage={() => sendTextHandler(text)}
        sendMediaMessage={(files) => sendMediaHandler(files)}
        disabled={isBlocked}
        friendTyping={friendTyping}
        setTyping={handleUserTyping}
      />

      {showPreview && selectedFiles.length > 0 && (
        <ImagePreviewModal
          previews={selectedFiles.map((f) => ({ file: f, url: URL.createObjectURL(f) }))}
          caption={caption}
          setCaption={setCaption}
          onRemove={(i) => setSelectedFiles((prev) => prev.filter((_, idx) => idx !== i))}
          onSend={async () => {
            await sendMessage(caption, selectedFiles);
            setShowPreview(false);
            setCaption("");
            setSelectedFiles([]);
          }}
          onClose={() => setShowPreview(false)}
          isDark={isDark}
        />
      )}

      {mediaViewer.open && (
        <MediaViewer
          items={mediaItems}
          startIndex={mediaViewer.startIndex}
          onClose={() => setMediaViewer({ open: false, startIndex: 0 })}
        />
      )}

      {longPressMessage && (
        <LongPressMessageModal
          onClose={() => setLongPressMessage(null)}
          onReaction={(emoji) => handleReact(longPressMessage.id, emoji)}
          onReply={() => {
            setReplyTo(longPressMessage);
            setLongPressMessage(null);
            // scroll into view
            setTimeout(() => scrollToMessage(longPressMessage.id), 200);
          }}
          onCopy={() => {
            navigator.clipboard.writeText(longPressMessage.text || "");
            toast.success("Copied!");
            setLongPressMessage(null);
          }}
          onPin={async () => {
            await updateDoc(doc(db, "chats", chatId), { pinnedMessageId: longPressMessage.id });
            setPinnedMessage(longPressMessage);
            toast.success("Pinned!");
            setLongPressMessage(null);
          }}
          onDeleteForMe={() => handleDeleteForMe(longPressMessage)}
          onDeleteForEveryone={() => handleDeleteForEveryone(longPressMessage)}
          isDark={isDark}
          messageSenderName={longPressMessage.senderId === myUid ? "You" : friendInfo?.name}
        />
      )}

      <ToastContainer position="top-center" autoClose={1500} hideProgressBar />
    </div>
  );
}