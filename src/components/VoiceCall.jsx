// src/components/VoiceCall.jsx
import React, { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { auth, db } from "../firebaseConfig";
import { doc, collection, setDoc, addDoc, onSnapshot, updateDoc } from "firebase/firestore";

// ---------------- CONFIG ----------------
const RATE_PER_SECOND = 0.0021;
const FREE_SECONDS = 10;

function pad(n) {
  return n < 10 ? `0${n}` : n;
}

export default function VoiceCall() {
  const { chatId, friendId } = useParams();
  const navigate = useNavigate();

  const pcRef = useRef(null);
  const localStreamRef = useRef(null);
  const remoteStreamRef = useRef(null);
  const callDocRef = useRef(null);

  const [user, setUser] = useState(null);
  const [connected, setConnected] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [duration, setDuration] = useState(0);
  const [cost, setCost] = useState(0);
  const [freeRemaining, setFreeRemaining] = useState(FREE_SECONDS);
  const [statusMessage, setStatusMessage] = useState("Connecting...");
  const [isStarting, setIsStarting] = useState(false);

  // ---------------- AUTH ----------------
  useEffect(() => {
    const unsub = auth.onAuthStateChanged((u) => {
      if (!u) navigate("/chat");
      else setUser(u);
    });
    return () => unsub();
  }, []);

  // ---------------- TIMER ----------------
  useEffect(() => {
    if (!connected) return;
    const iv = setInterval(() => {
      setDuration((d) => {
        const next = d + 1;
        if (next > FREE_SECONDS) setCost(((next - FREE_SECONDS) * RATE_PER_SECOND).toFixed(8));
        setFreeRemaining(Math.max(0, FREE_SECONDS - next));
        return next;
      });
    }, 1000);
    return () => clearInterval(iv);
  }, [connected]);

  // ---------------- PEER CONNECTION ----------------
  const preparePeerConnection = async () => {
    pcRef.current = new RTCPeerConnection({
      iceServers: [{ urls: ["stun:stun.l.google.com:19302"] }],
    });

    const remoteStream = new MediaStream();
    remoteStreamRef.current = remoteStream;
    pcRef.current.ontrack = (e) => {
      e.streams[0].getTracks().forEach((t) => remoteStream.addTrack(t));
    };

    callDocRef.current = doc(db, "calls", chatId);
    const callerCandidatesRef = collection(db, `calls/${chatId}/callerCandidates`);

    pcRef.current.onicecandidate = (event) => {
      if (event.candidate) addDoc(callerCandidatesRef, event.candidate.toJSON()).catch(console.error);
    };

    const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
    localStreamRef.current = stream;
    stream.getTracks().forEach((t) => pcRef.current.addTrack(t, stream));

    return { pc: pcRef.current, localStream: stream, remoteStream };
  };

  // ---------------- START CALL ----------------
  useEffect(() => {
    if (!user) return;
    startCall();
  }, [user]);

  const startCall = async () => {
    setIsStarting(true);
    setStatusMessage("Starting call...");

    try {
      await preparePeerConnection();

      const offer = await pcRef.current.createOffer();
      await pcRef.current.setLocalDescription(offer);

      await setDoc(callDocRef.current, { offer: { type: offer.type, sdp: offer.sdp }, status: "offer" });

      // ---------------- Auto-answer / listen for callee ----------------
      const unsubscribeAnswer = onSnapshot(callDocRef.current, async (snap) => {
        const data = snap.data();
        if (!data) return;

        if (data.answer && !pcRef.current.currentRemoteDescription) {
          await pcRef.current.setRemoteDescription(data.answer);
          setConnected(true);
          setStatusMessage("Connected");
        }

        if (data.status === "ended") handleRemoteEnd();
      });

      const calleeCandidatesRef = collection(db, `calls/${chatId}/calleeCandidates`);
      const unsubscribeCallee = onSnapshot(calleeCandidatesRef, (snap) => {
        snap.docChanges().forEach((change) => {
          if (change.type === "added") pcRef.current.addIceCandidate(change.doc.data()).catch(console.error);
        });
      });

      const audioEl = document.getElementById("remoteAudio");
      if (audioEl) audioEl.srcObject = remoteStreamRef.current;

      pcRef.current._cleanup = () => {
        unsubscribeAnswer();
        unsubscribeCallee();
      };
    } catch (err) {
      console.error(err);
      setStatusMessage("Failed to start call");
      await addMissedCallMessage();
      setTimeout(() => navigate("/chat"), 2000);
    } finally {
      setIsStarting(false);
    }
  };

  // ---------------- END CALL ----------------
  const endCall = async () => {
    try {
      await updateDoc(callDocRef.current, { status: "ended" });
    } catch {}
    cleanResources();
    navigate("/chat");
  };

  const cleanResources = () => {
    pcRef.current?._cleanup?.();
    pcRef.current?.getSenders().forEach((s) => s.track?.stop());
    pcRef.current?.close();
    pcRef.current = null;

    localStreamRef.current?.getTracks().forEach((t) => t.stop());
    localStreamRef.current = null;

    remoteStreamRef.current?.getTracks().forEach((t) => t.stop());
    remoteStreamRef.current = null;
  };

  const handleRemoteEnd = async () => {
    setStatusMessage("Call ended");

    // If never connected, mark as missed
    if (!connected) await addMissedCallMessage();

    setConnected(false);
    cleanResources();
    setTimeout(() => navigate("/chat"), 2000);
  };

  const addMissedCallMessage = async () => {
    if (!chatId || !friendId) return;
    try {
      const msgRef = collection(db, `chats/${chatId}/messages`);
      await addDoc(msgRef, {
        senderId: friendId,
        type: "missed_call",
        timestamp: new Date(),
        read: false,
      });
    } catch (err) {
      console.error("Failed to add missed call:", err);
    }
  };

  const toggleMute = () => {
    localStreamRef.current?.getAudioTracks().forEach((t) => (t.enabled = !t.enabled));
    setIsMuted((m) => !m);
  };

  return (
    <div style={{ padding: 20 }}>
      <h2>Voice Call {friendId ? `→ ${friendId}` : ""}</h2>

      <div style={{ marginBottom: 10 }}>
        <button onClick={endCall} disabled={!connected && !isStarting}>
          End Call
        </button>
        <button onClick={toggleMute} disabled={!connected}>
          {isMuted ? "Unmute" : "Mute"}
        </button>
      </div>

      <div>
        <strong>Status:</strong> {statusMessage}
      </div>
      <div>
        <strong>Duration:</strong> {pad(Math.floor(duration / 60))}:{pad(duration % 60)}
      </div>

      <div>
        {freeRemaining > 0 ? (
          <div>🎁 Free time remaining: {freeRemaining}s</div>
        ) : (
          <div>💵 Live cost: ${cost}</div>
        )}
      </div>

      <audio id="remoteAudio" autoPlay playsInline />
    </div>
  );
}