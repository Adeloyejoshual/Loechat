// src/components/CallPage.jsx
import React, { useEffect, useRef, useState } from "react";
import { auth, firestore } from "../firebaseConfig"; // client SDK: import { getAuth } etc.
import { useNavigate } from "react-router-dom";
import { collection, doc, setDoc, getDoc, onSnapshot, addDoc, updateDoc, deleteDoc } from "firebase/firestore";

// CONFIG
const backend = "https://smart-talk-zlxe.onrender.com";
const RATE_PER_SECOND = 0.0021;
const FREE_SECONDS = 10;

function pad(n) { return n < 10 ? `0${n}` : `${n}`; }

export default function CallPage({ receiverId }) {
  const navigate = useNavigate();
  const pcRef = useRef(null);
  const localStreamRef = useRef(null);
  const remoteStreamRef = useRef(null);
  const callDocRef = useRef(null);
  const callerCandidatesCollectionRef = useRef(null);
  const calleeCandidatesCollectionRef = useRef(null);

  const [user, setUser] = useState(null);
  const [callId, setCallId] = useState(null);
  const [connected, setConnected] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [duration, setDuration] = useState(0); // seconds
  const [cost, setCost] = useState(0);
  const [freeRemaining, setFreeRemaining] = useState(FREE_SECONDS);
  const [liveBalance, setLiveBalance] = useState(null);
  const [statusMessage, setStatusMessage] = useState("Ready");
  const [isStarting, setIsStarting] = useState(false);

  // get firebase token helper (similar to WalletPage)
  const getToken = async () => auth.currentUser && (await auth.currentUser.getIdToken(true));

  // auth listener
  useEffect(() => {
    const unsub = auth.onAuthStateChanged((u) => {
      if (!u) {
        navigate("/");
        return;
      }
      setUser(u);
    });
    return () => unsub();
  }, []);

  // Poll live wallet balance once per second (optional but useful)
  useEffect(() => {
    if (!user) return;
    let alive = true;
    const tick = async () => {
      try {
        const token = await getToken();
        const res = await fetch(`${backend}/api/wallet/live/${user.uid}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!alive) return;
        if (res.ok) {
          const data = await res.json();
          setLiveBalance(typeof data.balance === "number" ? data.balance : null);
          // if server returns call info and status ended, handle accordingly
          if (data.activeCall && data.activeCall.callId && data.activeCall.status === "ended") {
            // server ended call
            handleRemoteEnd();
          }
        }
      } catch (err) {
        // ignore poll errors
      }
    };

    tick();
    const iv = setInterval(tick, 1000);
    return () => { alive = false; clearInterval(iv); };
  }, [user]);

  // local timer increases every second while connected
  useEffect(() => {
    if (!connected) return;
    const iv = setInterval(() => {
      setDuration((d) => {
        const next = d + 1;
        // update cost only after free window
        if (next > FREE_SECONDS) {
          const billedSeconds = next - FREE_SECONDS;
          setCost((_) => +(billedSeconds * RATE_PER_SECOND).toFixed(8));
        } else {
          setCost(0);
        }
        setFreeRemaining(Math.max(0, FREE_SECONDS - next));
        return next;
      });
    }, 1000);

    return () => clearInterval(iv);
  }, [connected]);

  // helper: create PeerConnection and media
  const preparePeerConnection = async () => {
    pcRef.current = new RTCPeerConnection({
      iceServers: [{ urls: ["stun:stun.l.google.com:19302"] }]
    });

    // remote stream
    const remoteStream = new MediaStream();
    remoteStreamRef.current = remoteStream;
    // Attach remote stream to audio element later

    pcRef.current.ontrack = (event) => {
      event.streams[0] && event.streams[0].getTracks().forEach(t => remoteStream.addTrack(t));
    };

    // collect local ICE candidates to Firestore
    callerCandidatesCollectionRef.current = collection(firestore, `calls/${callId}/callerCandidates`);

    pcRef.current.onicecandidate = (event) => {
      if (!event.candidate) return;
      // push candidate to firestore
      addDoc(callerCandidatesCollectionRef.current, event.candidate.toJSON()).catch(console.error);
    };

    // get local media
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
    localStreamRef.current = stream;
    stream.getTracks().forEach(track => pcRef.current.addTrack(track, stream));

    return { pc: pcRef.current, localStream: stream, remoteStream };
  };

  // Start the call (caller flow)
  const startCall = async () => {
    if (!user) return alert("Not signed in");
    setIsStarting(true);
    setStatusMessage("Starting call...");

    try {
      // 1) request server to create call
      const token = await getToken();
      const res = await fetch(`${backend}/api/call/start`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ receiverId })
      });
      if (!res.ok) {
        const err = await res.json();
        setStatusMessage(err.error || "Failed to start call");
        setIsStarting(false);
        return;
      }

      const call = await res.json();
      // server returns callId (see server design)
      const id = call.callId || call._id || call.id;
      if (!id) {
        setStatusMessage("No callId from server");
        setIsStarting(false);
        return;
      }
      setCallId(id);

      // create Firestore doc references for signaling
      callDocRef.current = doc(firestore, "calls", id);
      callerCandidatesCollectionRef.current = collection(firestore, `calls/${id}/callerCandidates`);
      calleeCandidatesCollectionRef.current = collection(firestore, `calls/${id}/calleeCandidates`);

      // 2) prepare local peer connection + media
      await preparePeerConnection();

      // 3) create offer
      const offer = await pcRef.current.createOffer();
      await pcRef.current.setLocalDescription(offer);

      // 4) write offer to Firestore `calls/{id}` so callee can answer
      await setDoc(callDocRef.current, { offer: { type: offer.type, sdp: offer.sdp }, status: "offer" }, { merge: true });

      // 5) listen for answer
      const unsubscribeAnswer = onSnapshot(callDocRef.current, (snapshot) => {
        const data = snapshot.data();
        if (!pcRef.current.currentRemoteDescription && data?.answer) {
          const answer = new RTCSessionDescription(data.answer);
          pcRef.current.setRemoteDescription(answer).catch(console.error);
          setStatusMessage("Connected (answer received)");
        }
        // if server or worker sets status ended, handle it
        if (data?.status === "ended") {
          handleRemoteEnd();
        }
      });

      // 6) listen for callee ICE candidates and add them
      const unsubscribeCalleeCandidates = onSnapshot(collection(firestore, `calls/${id}/calleeCandidates`), (snap) => {
        snap.docChanges().forEach(change => {
          if (change.type === "added") {
            const cand = change.doc.data();
            pcRef.current.addIceCandidate(new RTCIceCandidate(cand)).catch(console.error);
          }
        });
      });

      // 7) set remote audio element to remoteStreamRef
      const audioEl = document.getElementById("remoteAudio");
      if (audioEl) audioEl.srcObject = remoteStreamRef.current;

      setConnected(true);
      setStatusMessage("Call ring / connecting...");
      setIsStarting(false);

      // Clean-up when component unmounts
      const cleanup = () => {
        unsubscribeAnswer && unsubscribeAnswer();
        unsubscribeCalleeCandidates && unsubscribeCalleeCandidates();
      };

      // store cleanup to ref so endCall can call it
      pcRef.current._cleanup = cleanup;

    } catch (err) {
      console.error("startCall error", err);
      setStatusMessage("Failed to start call");
      setIsStarting(false);
    }
  };

  // End / hang up locally and inform server
  const endCall = async () => {
    try {
      if (callId) {
        const token = await getToken();
        await fetch(`${backend}/api/call/end`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({ callId })
        }).catch(console.error);
      }
    } catch (err) { /* ignore */ }

    cleanLocalResources();
    navigate("/"); // or go to previous page
  };

  // Clean up local media & PC
  const cleanLocalResources = () => {
    try {
      if (pcRef.current) {
        try { pcRef.current._cleanup && pcRef.current._cleanup(); } catch(e){}
        pcRef.current.getSenders().forEach(s => { try { s.track && s.track.stop(); } catch(e){} });
        try { pcRef.current.close(); } catch(e){}
        pcRef.current = null;
      }
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach(t => t.stop());
        localStreamRef.current = null;
      }
      if (remoteStreamRef.current) {
        remoteStreamRef.current.getTracks().forEach(t => t.stop());
        remoteStreamRef.current = null;
      }
      // optional: remove signaling docs (callerCandidates) to keep db tidy
      if (callId) {
        // best-effort cleanup of signalling collections (not critical)
        const cleanupSignaling = async () => {
          try {
            const callerC = collection(firestore, `calls/${callId}/callerCandidates`);
            const calleeC = collection(firestore, `calls/${callId}/calleeCandidates`);
            // NOTE: Firestore doesn't allow deleting collections easily from client; omit heavy cleanup
          } catch (e) { /* ignore */ }
        };
        cleanupSignaling();
      }
    } catch (err) {
      console.error("cleanLocalResources err", err);
    }
  };

  // Called when server/worker ends the call remotely
  const handleRemoteEnd = () => {
    setStatusMessage("Call ended (insufficient funds or remote hangup)");
    setConnected(false);
    cleanLocalResources();
    // show a popup or navigate away after a short delay
    setTimeout(() => navigate("/"), 2000);
  };

  // Toggle mute
  const toggleMute = () => {
    if (!localStreamRef.current) return;
    localStreamRef.current.getAudioTracks().forEach(t => (t.enabled = !t.enabled));
    setIsMuted((m) => !m);
  };

  return (
    <div style={{ padding: 20 }}>
      <h2>Call {receiverId ? `→ ${receiverId}` : ""}</h2>

      <div style={{ marginBottom: 10 }}>
        <button onClick={startCall} disabled={isStarting || connected} style={{ marginRight: 8 }}>
          {isStarting ? "Starting..." : connected ? "In call" : "Start Call"}
        </button>
        <button onClick={endCall} disabled={!connected && !isStarting}>End Call</button>
        <button onClick={toggleMute} disabled={!connected} style={{ marginLeft: 8 }}>
          {isMuted ? "Unmute" : "Mute"}
        </button>
      </div>

      <div style={{ marginTop: 10 }}>
        <strong>Status:</strong> {statusMessage}
      </div>

      <div style={{ marginTop: 10 }}>
        <strong>Duration:</strong> {pad(Math.floor(duration / 60))}:{pad(duration % 60)}
      </div>

      <div style={{ marginTop: 8 }}>
        {freeRemaining > 0 ? (
          <div style={{ background: "#f0f9ff", padding: 8, borderRadius: 8 }}>
            🎁 Free time remaining: {freeRemaining}s (first {FREE_SECONDS}s free)
          </div>
        ) : (
          <div style={{ background: "#fff7ed", padding: 8, borderRadius: 8 }}>
            💵 Live cost: ${cost.toFixed(4)} ({(RATE_PER_SECOND).toFixed(4)}/s)
          </div>
        )}
      </div>

      <div style={{ marginTop: 8 }}>
        {liveBalance !== null && (
          <div style={{ background: liveBalance < 0.5 ? "#ffe7e7" : "#e6ffe6", padding: 8, borderRadius: 8 }}>
            Wallet balance: ${liveBalance.toFixed(2)} {liveBalance < 0.5 && "— low balance"}
          </div>
        )}
      </div>

      {/* Hidden audio element for remote audio */}
      <audio id="remoteAudio" autoPlay playsInline />

      <div style={{ marginTop: 20 }}>
        <small>Notes: first {FREE_SECONDS}s are free — server enforces billing & will end call when balance is insufficient.</small>
      </div>
    </div>
  );
}