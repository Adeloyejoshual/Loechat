// src/components/VoiceCall.jsx
import React, { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { auth, db } from "../firebaseConfig"; // <- updated
import { doc, collection, setDoc, addDoc, onSnapshot } from "firebase/firestore";

// ---------------- CONFIG ----------------
const BACKEND = "https://smart-talk-zlxe.onrender.com";
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
  const [liveBalance, setLiveBalance] = useState(null);
  const [statusMessage, setStatusMessage] = useState("Ready");
  const [isStarting, setIsStarting] = useState(false);

  // ---------------- HELPERS ----------------
  const getToken = async () => auth.currentUser && (await auth.currentUser.getIdToken(true));

  const updateLiveBalance = async () => {
    if (!user) return;
    try {
      const token = await getToken();
      const res = await fetch(`${BACKEND}/api/wallet/live/${user.uid}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setLiveBalance(data.balance ?? null);
        if (data.activeCall?.status === "ended") handleRemoteEnd();
      }
    } catch {}
  };

  // ---------------- AUTH ----------------
  useEffect(() => {
    const unsub = auth.onAuthStateChanged((u) => {
      if (!u) navigate("/");
      else setUser(u);
    });
    return () => unsub();
  }, []);

  // ---------------- LIVE WALLET POLLING ----------------
  useEffect(() => {
    const iv = setInterval(updateLiveBalance, 1000);
    return () => clearInterval(iv);
  }, [user]);

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
      if (!event.candidate) return;
      addDoc(callerCandidatesRef, event.candidate.toJSON()).catch(console.error);
    };

    const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
    localStreamRef.current = stream;
    stream.getTracks().forEach((t) => pcRef.current.addTrack(t, stream));

    return { pc: pcRef.current, localStream: stream, remoteStream };
  };

  // ---------------- START CALL ----------------
  const startCall = async () => {
    if (!user) return alert("Not signed in");
    setIsStarting(true);
    setStatusMessage("Starting call...");

    try {
      const token = await getToken();
      const res = await fetch(`${BACKEND}/api/call/start`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ receiverId: friendId }),
      });
      if (!res.ok) throw new Error("Failed to start call");

      const data = await res.json();
      setConnected(true);

      await preparePeerConnection();
      const offer = await pcRef.current.createOffer();
      await pcRef.current.setLocalDescription(offer);
      await setDoc(callDocRef.current, { offer: { type: offer.type, sdp: offer.sdp }, status: "offer" });

      const unsubscribeAnswer = onSnapshot(callDocRef.current, (snap) => {
        const callData = snap.data();
        if (callData?.answer && !pcRef.current.currentRemoteDescription) {
          pcRef.current.setRemoteDescription(callData.answer).catch(console.error);
          setStatusMessage("Connected");
        }
        if (callData?.status === "ended") handleRemoteEnd();
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
    } finally {
      setIsStarting(false);
    }
  };

  // ---------------- END CALL ----------------
  const endCall = async () => {
    try {
      const token = await getToken();
      await fetch(`${BACKEND}/api/call/end`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ callId: chatId }),
      });
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

  const handleRemoteEnd = () => {
    setStatusMessage("Call ended");
    setConnected(false);
    cleanResources();
    setTimeout(() => navigate("/chat"), 2000);
  };

  const toggleMute = () => {
    localStreamRef.current?.getAudioTracks().forEach((t) => (t.enabled = !t.enabled));
    setIsMuted((m) => !m);
  };

  return (
    <div style={{ padding: 20 }}>
      <h2>Voice Call {friendId ? `→ ${friendId}` : ""}</h2>

      <div style={{ marginBottom: 10 }}>
        <button onClick={startCall} disabled={isStarting || connected}>
          {isStarting ? "Starting..." : connected ? "In Call" : "Start Call"}
        </button>
        <button onClick={endCall} disabled={!connected}>
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

      {liveBalance !== null && <div>Wallet balance: ${liveBalance.toFixed(2)}</div>}

      <audio id="remoteAudio" autoPlay playsInline />
    </div>
  );
}