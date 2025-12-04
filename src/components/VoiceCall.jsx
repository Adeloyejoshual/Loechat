import React, { useEffect, useRef, useState } from "react";
import { auth, db } from "../firebaseConfig"; // ✅ FIXED
import { useNavigate } from "react-router-dom";
import {
  collection,
  doc,
  setDoc,
  onSnapshot,
  addDoc,
} from "firebase/firestore";

// ================= CONFIG =================
const backend = "https://smart-talk-zlxe.onrender.com";
const RATE_PER_SECOND = 0.0021;
const FREE_SECONDS = 10;

function pad(n) {
  return n < 10 ? `0${n}` : `${n}`;
}

export default function VoiceCall({ receiverId }) {
  const navigate = useNavigate();

  const pcRef = useRef(null);
  const localStreamRef = useRef(null);
  const remoteStreamRef = useRef(null);
  const callDocRef = useRef(null);

  const [user, setUser] = useState(null);
  const [callId, setCallId] = useState(null);
  const [connected, setConnected] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [duration, setDuration] = useState(0);
  const [cost, setCost] = useState(0);
  const [freeRemaining, setFreeRemaining] = useState(FREE_SECONDS);
  const [liveBalance, setLiveBalance] = useState(null);
  const [status, setStatus] = useState("Ready");
  const [starting, setStarting] = useState(false);

  // ================= AUTH =================
  const getToken = async () =>
    auth.currentUser && (await auth.currentUser.getIdToken(true));

  useEffect(() => {
    const unsub = auth.onAuthStateChanged((u) => {
      if (!u) navigate("/");
      else setUser(u);
    });
    return () => unsub();
  }, []);

  // ================= LIVE WALLET POLL =================
  useEffect(() => {
    if (!user) return;

    const iv = setInterval(async () => {
      try {
        const token = await getToken();
        const res = await fetch(`${backend}/api/wallet/live/${user.uid}`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (res.ok) {
          const data = await res.json();
          setLiveBalance(data.balance);

          if (data.activeCall?.status === "ended") {
            handleRemoteEnd();
          }
        }
      } catch {}
    }, 1000);

    return () => clearInterval(iv);
  }, [user]);

  // ================= TIMER =================
  useEffect(() => {
    if (!connected) return;

    const iv = setInterval(() => {
      setDuration((d) => {
        const next = d + 1;

        if (next > FREE_SECONDS) {
          const billed = next - FREE_SECONDS;
          setCost(+(billed * RATE_PER_SECOND).toFixed(8));
        }

        setFreeRemaining(Math.max(0, FREE_SECONDS - next));
        return next;
      });
    }, 1000);

    return () => clearInterval(iv);
  }, [connected]);

  // ================= PEER SETUP =================
  const preparePeerConnection = async (id) => {
    const pc = new RTCPeerConnection({
      iceServers: [{ urls: ["stun:stun.l.google.com:19302"] }],
    });

    pcRef.current = pc;

    const remoteStream = new MediaStream();
    remoteStreamRef.current = remoteStream;

    pc.ontrack = (e) => {
      e.streams[0].getTracks().forEach((t) => remoteStream.addTrack(t));
    };

    const callerCandidates = collection(db, `calls/${id}/callerCandidates`);
    pc.onicecandidate = (e) => {
      e.candidate && addDoc(callerCandidates, e.candidate.toJSON());
    };

    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    localStreamRef.current = stream;
    stream.getTracks().forEach((t) => pc.addTrack(t, stream));

    document.getElementById("remoteAudio").srcObject = remoteStream;
  };

  // ================= START CALL =================
  const startCall = async () => {
    if (!user) return alert("Not signed in");

    setStarting(true);
    setStatus("Starting call...");

    try {
      const token = await getToken();

      const res = await fetch(`${backend}/api/call/start`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ receiverId }),
      });

      const data = await res.json();
      if (!res.ok) return setStatus(data.error || "Call failed");

      const id = data.callId;
      setCallId(id);

      callDocRef.current = doc(db, "calls", id);

      await preparePeerConnection(id);

      const offer = await pcRef.current.createOffer();
      await pcRef.current.setLocalDescription(offer);

      await setDoc(callDocRef.current, {
        offer,
        status: "offer",
        createdAt: Date.now(),
      });

      onSnapshot(callDocRef.current, (snap) => {
        const d = snap.data();

        if (d?.answer && !pcRef.current.currentRemoteDescription) {
          pcRef.current.setRemoteDescription(d.answer);
          setConnected(true);
          setStatus("Connected");
        }

        if (d?.status === "ended") {
          handleRemoteEnd();
        }
      });

      setStarting(false);
    } catch (err) {
      console.error(err);
      setStatus("Call failed");
      setStarting(false);
    }
  };

  // ================= END CALL =================
  const endCall = async () => {
    try {
      const token = await getToken();
      await fetch(`${backend}/api/call/end`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ callId }),
      });
    } catch {}

    cleanUp();
    navigate("/");
  };

  // ================= CLEANUP =================
  const cleanUp = () => {
    pcRef.current?.getSenders().forEach((s) => s.track?.stop());
    pcRef.current?.close();
    localStreamRef.current?.getTracks().forEach((t) => t.stop());
  };

  const handleRemoteEnd = () => {
    setStatus("Call ended");
    cleanUp();
    setTimeout(() => navigate("/"), 2000);
  };

  const toggleMute = () => {
    localStreamRef.current
      ?.getAudioTracks()
      .forEach((t) => (t.enabled = !t.enabled));
    setIsMuted((m) => !m);
  };

  return (
    <div style={{ padding: 20 }}>
      <h2>Calling {receiverId}</h2>

      <button onClick={startCall} disabled={starting || connected}>
        {starting ? "Starting..." : "Start"}
      </button>

      <button onClick={endCall} disabled={!connected}>
        End
      </button>

      <button onClick={toggleMute} disabled={!connected}>
        {isMuted ? "Unmute" : "Mute"}
      </button>

      <div>Status: {status}</div>

      <div>
        Time: {pad(Math.floor(duration / 60))}:{pad(duration % 60)}
      </div>

      {freeRemaining > 0 ? (
        <div>🎁 Free time left: {freeRemaining}s</div>
      ) : (
        <div>💵 Cost: ${cost.toFixed(4)}</div>
      )}

      {liveBalance !== null && <div>Wallet: ${liveBalance.toFixed(2)}</div>}

      <audio id="remoteAudio" autoPlay />
    </div>
  );
}