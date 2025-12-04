// src/components/VoiceCall.jsx
import React, { useEffect, useRef, useState, useContext } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { doc, setDoc, onSnapshot, deleteDoc, serverTimestamp } from "firebase/firestore";
import { db, auth } from "../firebaseConfig";
import { FiPhoneOff, FiMic, FiMicOff } from "react-icons/fi";
import { UserContext } from "../context/UserContext";

export default function VoiceCall() {
  const { friendId } = useParams();
  const navigate = useNavigate();
  const { profileName } = useContext(UserContext);
  const myUid = auth.currentUser.uid;

  const localAudioRef = useRef(null);
  const remoteAudioRef = useRef(null);
  const pcRef = useRef(null);

  const [callId, setCallId] = useState(null);
  const [incomingCall, setIncomingCall] = useState(false);
  const [callActive, setCallActive] = useState(false);
  const [muted, setMuted] = useState(false);
  const [friendName, setFriendName] = useState("Friend");

  // -------------------- Generate Peer Connection --------------------
  const createPeerConnection = () => {
    const pc = new RTCPeerConnection({
      iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
    });

    pc.ontrack = (event) => {
      if (remoteAudioRef.current) remoteAudioRef.current.srcObject = event.streams[0];
    };

    pc.onicecandidate = async (event) => {
      if (event.candidate && callId) {
        const callRef = doc(db, "calls", callId);
        await setDoc(callRef, { candidate: event.candidate }, { merge: true });
      }
    };

    pcRef.current = pc;
    return pc;
  };

  // -------------------- Start Call (Caller) --------------------
  const startCall = async () => {
    const callRef = doc(db, "calls", `${myUid}_${friendId}`);
    setCallId(callRef.id);

    const pc = createPeerConnection();

    // Add local audio
    const localStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    localAudioRef.current.srcObject = localStream;
    localStream.getTracks().forEach((track) => pc.addTrack(track, localStream));

    // Firestore signaling
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    await setDoc(callRef, { offer: offer.toJSON(), from: myUid, to: friendId, timestamp: serverTimestamp() });

    // Listen for answer
    onSnapshot(callRef, async (snap) => {
      const data = snap.data();
      if (!data) return;
      if (data.answer && !pc.currentRemoteDescription) {
        await pc.setRemoteDescription(new RTCSessionDescription(data.answer));
        setCallActive(true);
      }
      if (data.candidate) {
        try {
          await pc.addIceCandidate(data.candidate);
        } catch (err) {
          console.error("ICE candidate error:", err);
        }
      }
    });

    // Handle cleanup if callee rejects or ends
    onSnapshot(callRef, (snap) => {
      const data = snap.data();
      if (!data) hangUp();
    });

    setCallActive(true);
  };

  // -------------------- Receive Call (Callee) --------------------
  useEffect(() => {
    const callRef = doc(db, "calls", `${friendId}_${myUid}`);
    const unsub = onSnapshot(callRef, (snap) => {
      const data = snap.data();
      if (data && data.offer && !callActive) {
        setIncomingCall(true);
        setCallId(callRef.id);
      }
    });

    return () => unsub();
  }, [friendId, myUid, callActive]);

  const answerCall = async () => {
    const callRef = doc(db, "calls", callId);
    const pc = createPeerConnection();

    // Add local audio
    const localStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    localAudioRef.current.srcObject = localStream;
    localStream.getTracks().forEach((track) => pc.addTrack(track, localStream));

    // Get offer from caller
    const snap = await callRef.get();
    const data = snap.data();
    await pc.setRemoteDescription(new RTCSessionDescription(data.offer));

    // Create answer
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);
    await setDoc(callRef, { answer: answer.toJSON() }, { merge: true });

    // Listen for ICE candidates
    onSnapshot(callRef, async (snap) => {
      const data = snap.data();
      if (data?.candidate) {
        try {
          await pc.addIceCandidate(data.candidate);
        } catch (err) {
          console.error("ICE candidate error:", err);
        }
      }
    });

    setIncomingCall(false);
    setCallActive(true);
  };

  // -------------------- Hang Up --------------------
  const hangUp = async () => {
    if (pcRef.current) {
      pcRef.current.getTracks().forEach((track) => track.stop());
      pcRef.current.close();
    }
    if (callId) await deleteDoc(doc(db, "calls", callId));
    navigate("/chat");
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh", alignItems: "center", justifyContent: "center", background: "#075e54", color: "#fff" }}>
      <audio ref={localAudioRef} autoPlay muted />
      <audio ref={remoteAudioRef} autoPlay />

      {incomingCall && (
        <div>
          <h2>{friendName} is calling...</h2>
          <button onClick={answerCall} style={{ margin: 8 }}>Answer</button>
          <button onClick={hangUp} style={{ margin: 8 }}>Reject</button>
        </div>
      )}

      {callActive && (
        <div>
          <h2>In Call with {friendName}</h2>
          <button onClick={() => setMuted(!muted)} style={{ margin: 8 }}>
            {muted ? <FiMicOff /> : <FiMic />}
          </button>
          <button onClick={hangUp} style={{ margin: 8 }}>
            <FiPhoneOff />
          </button>
        </div>
      )}

      {!incomingCall && !callActive && (
        <button onClick={startCall}>Call {friendName}</button>
      )}
    </div>
  );
}
