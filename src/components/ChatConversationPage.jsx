// src/components/Chat/ChatConversationPage.jsx
import React, { useEffect, useState, useRef, useContext, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
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
import { ref, uploadBytesResumable, getDownloadURL } from "firebase/storage";
import { db, auth, storage } from "../firebaseConfig";
import { ThemeContext } from "../context/ThemeContext";
import { UserContext } from "../context/UserContext";

import ChatHeader from "./Chat/ChatHeader";
import MessageItem from "./Chat/MessageItem";
import ChatInput from "./Chat/ChatInput";
import MediaViewer from "./Chat/MediaViewer";
import TypingIndicator from "./Chat/TypingIndicator";
import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

export default function ChatConversationPage() {
  const { chatId } = useParams();
  const navigate = useNavigate();
  const { theme, wallpaper } = useContext(ThemeContext);
  const { profilePic, profileName } = useContext(UserContext);
  const isDark = theme === "dark";
  const myUid = auth.currentUser?.uid;

  const messagesRefEl = useRef(null);

  const [chatInfo, setChatInfo] = useState(null);
  const [friendInfo, setFriendInfo] = useState(null);
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [replyTo, setReplyTo] = useState(null);
  const [pinnedMessage, setPinnedMessage] = useState(null);
  const [isBlocked, setIsBlocked] = useState(false);
  const [mediaViewerData, setMediaViewerData] = useState({ isOpen: false, items: [], startIndex: 0 });
  const [typingUsers, setTypingUsers] = useState({});
  const [loading, setLoading] = useState(true);

  const friendId = friendInfo?.id || null;

  // -------------------- Load chat & friend --------------------
  useEffect(() => {
    if (!chatId) return;
    setLoading(true);

    const chatRef = doc(db, "chats", chatId);
    const unsubChat = onSnapshot(chatRef, (snap) => {
      if (!snap.exists()) return;
      const data = snap.data();
      setChatInfo({ id: snap.id, ...data });
      setIsBlocked(data.blocked || false);
      setTypingUsers(data.typing || {});

      const friendId = data.participants?.find((p) => p !== myUid);
      if (friendId) {
        const userRef = doc(db, "users", friendId);
        onSnapshot(userRef, (s) => s.exists() && setFriendInfo({ id: s.id, ...s.data() }));
      }

      if (data.pinnedMessageId) {
        const pinnedRef = doc(db, "chats", chatId, "messages", data.pinnedMessageId);
        onSnapshot(pinnedRef, (s) => s.exists() && setPinnedMessage({ id: s.id, ...s.data() }));
      }

      setLoading(false);
    });

    return () => unsubChat();
  }, [chatId, myUid]);

  // -------------------- Real-time messages --------------------
  useEffect(() => {
    if (!chatId) return;
    const messagesRef = collection(db, "chats", chatId, "messages");
    const q = query(messagesRef, orderBy("createdAt", "desc"));

    const unsub = onSnapshot(q, (snap) => {
      const docs = snap.docs.map((d) => ({ id: d.id, ...d.data(), status: "sent" }));
      setMessages((prev) => {
        // Merge with existing uploading messages
        const uploading = prev.filter((m) => m.status === "uploading");
        return [...docs, ...uploading];
      });
      scrollToTop();
    });

    return () => unsub();
  }, [chatId]);

  const scrollToTop = useCallback(() => {
    messagesRefEl.current?.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  const scrollToMessage = useCallback((id) => {
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
  }, []);

  // -------------------- Date separator --------------------
  const formatDateSeparator = (date) => {
    if (!date) return "";
    const msgDate = new Date(date.toDate?.() || date);
    const now = new Date();
    const yesterday = new Date();
    yesterday.setDate(now.getDate() - 1);

    if (msgDate.toDateString() === now.toDateString()) return "Today";
    if (msgDate.toDateString() === yesterday.toDateString()) return "Yesterday";

    const options = { month: "short", day: "numeric" };
    if (msgDate.getFullYear() !== now.getFullYear()) options.year = "numeric";
    return msgDate.toLocaleDateString(undefined, options);
  };

  const groupedMessages = [];
  let lastDate = null;
  messages.forEach((msg) => {
    const dateStr = formatDateSeparator(msg.createdAt);
    if (dateStr !== lastDate) {
      groupedMessages.push({ type: "date-separator", date: dateStr });
      lastDate = dateStr;
    }
    groupedMessages.push({ type: "message", data: msg });
  });

  // -------------------- Media Viewer --------------------
  const handleOpenMediaViewer = (clickedUrl) => {
    const mediaItems = messages
      .filter((m) => m.mediaUrl)
      .map((m) => ({ url: m.mediaUrl, type: m.mediaType || "image" }));

    const startIndex = mediaItems.findIndex((m) => m.url === clickedUrl);

    setMediaViewerData({
      isOpen: true,
      items: mediaItems,
      startIndex: startIndex >= 0 ? startIndex : 0,
    });
  };

  // -------------------- Chat actions --------------------
  const startVoiceCall = () => {
    if (!friendId) return toast.error("Cannot start call — user not loaded yet.");
    navigate(`/voicecall/${chatId}/${friendId}`);
  };

  const startVideoCall = () => {
    if (!friendId) return toast.error("Cannot start call — user not loaded yet.");
    navigate(`/videocall/${chatId}/${friendId}`);
  };

  const onSearch = () => toast.info("Search not implemented.");
  const onGoToPinned = (messageId) => {
    const id = messageId || pinnedMessage?.id;
    if (id) scrollToMessage(id);
    else toast.info("No pinned message available.");
  };

  // -------------------- Add messages helper --------------------
  const addMessages = (newMessages, replaceId = null) => {
    setMessages((prev) => {
      if (!replaceId) return [...newMessages, ...prev];
      return prev.map((m) => (m.id === replaceId ? newMessages[0] : m));
    });
  };

  // -------------------- Upload files --------------------
  const uploadFiles = async (file, replyTo) => {
    const tempId = "temp-" + Date.now();
    const tempMsg = {
      id: tempId,
      mediaUrl: URL.createObjectURL(file),
      mediaType: file.type.startsWith("video/") ? "video" : "image",
      senderId: myUid,
      status: "uploading",
      uploadProgress: 0,
      createdAt: new Date(),
      replyTo: replyTo ? replyTo.id : null,
      retry: () => uploadFiles(file, replyTo), // allow retry
    };

    addMessages([tempMsg]);

    const storageRef = ref(storage, `chatFiles/${chatId}/${Date.now()}-${file.name}`);
    const uploadTask = uploadBytesResumable(storageRef, file);

    uploadTask.on(
      "state_changed",
      (snapshot) => {
        const progress = Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100);
        setMessages((prev) =>
          prev.map((m) => (m.id === tempId ? { ...m, uploadProgress: progress } : m))
        );
      },
      (error) => {
        toast.error("Upload failed: " + error.message);
        setMessages((prev) =>
          prev.map((m) => (m.id === tempId ? { ...m, status: "failed" } : m))
        );
      },
      async () => {
        const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
        const msgRef = await addDoc(collection(db, "chats", chatId, "messages"), {
          mediaUrl: downloadURL,
          mediaType: file.type.startsWith("video/") ? "video" : "image",
          text: "",
          createdAt: serverTimestamp(),
          senderId: myUid,
          replyTo: replyTo ? replyTo.id : null,
        });
        setMessages((prev) =>
          prev.map((m) =>
            m.id === tempId
              ? { ...m, id: msgRef.id, mediaUrl: downloadURL, status: "sent", uploadProgress: 100 }
              : m
          )
        );
      }
    );
  };

  // -------------------- Loading --------------------
  if (loading) {
    return (
      <div style={{ flex: 1, display: "flex", justifyContent: "center", alignItems: "center", height: "100vh" }}>
        <p>Loading chat...</p>
      </div>
    );
  }

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100vh",
        backgroundColor: wallpaper || (isDark ? "#0b0b0b" : "#f5f5f5"),
        color: isDark ? "#fff" : "#000",
      }}
    >
      <ChatHeader
        friendId={friendId}
        chatId={chatId}
        pinnedMessage={pinnedMessage}
        setBlockedStatus={setIsBlocked}
        onClearChat={async () => {
          if (!window.confirm("Clear this chat?")) return;
          messages.forEach(async (msg) => {
            const msgRef = doc(db, "chats", chatId, "messages", msg.id);
            await updateDoc(msgRef, { deleted: true });
          });
          toast.success("Chat cleared");
        }}
        onSearch={onSearch}
        onGoToPinned={onGoToPinned}
      />

      {/* Messages */}
      <div
        ref={messagesRefEl}
        style={{
          flex: 1,
          overflowY: "auto",
          padding: 8,
          display: "flex",
          flexDirection: "column-reverse",
        }}
      >
        {groupedMessages.map((item, idx) =>
          item.type === "date-separator" ? (
            <div
              key={idx}
              style={{ textAlign: "center", margin: "10px 0", fontSize: 12, color: isDark ? "#aaa" : "#555" }}
            >
              {item.date}
            </div>
          ) : (
            <MessageItem
              key={item.data.id}
              message={item.data}
              myUid={myUid}
              isDark={isDark}
              chatId={chatId}
              setReplyTo={setReplyTo}
              pinnedMessage={pinnedMessage}
              setPinnedMessage={setPinnedMessage}
              friendId={friendId}
              onReplyClick={scrollToMessage}
              onOpenMediaViewer={handleOpenMediaViewer}
              typing={!!typingUsers[item.data.senderId]}
            />
          )
        )}

        <TypingIndicator typingUsers={typingUsers} myUid={myUid} />
      </div>

      <ChatInput
        text={text}
        setText={setText}
        selectedFiles={selectedFiles}
        setSelectedFiles={setSelectedFiles}
        isDark={isDark}
        replyTo={replyTo}
        setReplyTo={setReplyTo}
        addMessages={addMessages}
        uploadFiles={uploadFiles}
      />

      {mediaViewerData.isOpen && (
        <MediaViewer
          items={mediaViewerData.items}
          startIndex={mediaViewerData.startIndex}
          onClose={() => setMediaViewerData({ ...mediaViewerData, isOpen: false })}
        />
      )}

      <ToastContainer position="top-center" autoClose={1500} hideProgressBar />
    </div>
  );
}