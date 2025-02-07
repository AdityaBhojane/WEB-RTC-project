import { useCallback, useEffect, useState } from "react";
import { useSocket } from "../../context/socketProvider";
import ReactPlayer from "react-player";
import peer from "../service/peer";

export default function Room() {
  const socket = useSocket();
  const [remoteSocketId, setRemoteSocketId] = useState("");
  //   const [myStream, setMyStream] = useState(null);
  const [remoteStream, setRemoteStream] = useState(null);
  const [isCameraOn, setIsCameraOn] = useState(true);
  const [isAudioOn, setIsAudioOn] = useState(true);
  const [myCameraStream, setMyCameraStream] = useState(null);
  const [myScreenStream, setMyScreenStream] = useState(null);
  const [isScreenSharing, setIsScreenSharing] = useState(false);

  const toggleCamera = () => {
    if (myCameraStream) {
      const videoTrack = myCameraStream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setIsCameraOn(videoTrack.enabled);
      }
    }
  };

  const toggleAudio = () => {
    if (myCameraStream) {
      const audioTrack = myCameraStream.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setIsAudioOn(audioTrack.enabled);
      }
    }
  };

  //   screen share logic
  const startScreenShare = async () => {
    if (!isScreenSharing) {
      try {
        const screenStream = await navigator.mediaDevices.getDisplayMedia({
          video: true,
        });
  
        setMyScreenStream(screenStream);
        setIsScreenSharing(true);
  
        // Send screen stream separately to peer
        screenStream.getTracks().forEach((track) => {
          peer.peer.addTrack(track, screenStream);
        });
  
        // Properly handle when user stops screen share manually
        screenStream.getVideoTracks()[0].onended = () => {
          stopScreenShare();
        };
  
      } catch (error) {
        console.error("Error sharing screen:", error);
      }
    } else {
      stopScreenShare();
    }
  };
  
  const stopScreenShare = () => {
    if (myScreenStream) {
      myScreenStream.getTracks().forEach((track) => track.stop());
      setMyScreenStream(null);
      setIsScreenSharing(false);
    }
  };
  

  // User joined the room
  const handleUserJoined = useCallback(({ email, id }) => {
    console.log(`${email} joined the room with id ${id}`);
    setRemoteSocketId(id);
  }, []);

  // User call a user
  const handleCallUser = useCallback(async () => {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: true,
      audio: true,
    });
    const offer = await peer.createOffer();
    socket.emit("user-call", { offer, to: remoteSocketId });
    setMyCameraStream(stream);
    // setMyStream(stream);
  }, [remoteSocketId, socket]);

  // User received a call
  const handleIncomingCall = useCallback(
    async ({ offer, from }) => {
      setRemoteSocketId(from);
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true,
      });
      setMyCameraStream(stream);
      //   setMyStream(stream);
      console.log("incoming call", from, offer);
      const answer = await peer.getAnswer(offer);
      socket.emit("call-accepted", { to: from, ans: answer });
    },
    [socket]
  );

  //   //send stream
  //   const sendStream = useCallback(async () => {
  //     console.log("sending stream");
  //     for (const track of myStream.getTracks()) {
  //       peer.peer.addTrack(track, myStream);
  //     }
  //   }, [myStream]);

  const sendStream = useCallback(async () => {
    console.log("🚀 Sending Stream", myCameraStream);
    if (!myCameraStream) {
      console.error("❌ No stream to send!");
      return;
    }

    for (const track of myCameraStream.getTracks()) {
      console.log(`🎵 Adding Track: ${track.kind}`, track);
      peer.peer.addTrack(track, myCameraStream);
    }

    console.log("✅ All Tracks Added");
  }, [myCameraStream]);

  // handle call accept
  const handleCallAccepted = useCallback(
    async ({ from, ans }) => {
      peer.setAnswer(ans);
      console.log("call accepted", from, ans);

      console.log("🕵️ Remote Description Set?", peer.peer.remoteDescription);

      sendStream();
    },
    [sendStream]
  );

  // handle negotiation needed
  const handlePeerNegotiation = useCallback(async () => {
    console.log("negotiation started");
    const offer = await peer.createOffer();
    socket.emit("peer-negotiation-needed", { offer, to: remoteSocketId });
  }, [remoteSocketId, socket]);

  // handle negotiation final
  const handlePeerNegotiationFinal = useCallback(async ({ ans }) => {
    console.log("negotiation done");
    await peer.setAnswer(ans);
  }, []);

  // handle negotiation incoming
  const handleIncomingNegotiation = useCallback(
    async ({ from, offer }) => {
      console.log("incoming negotiation", from, offer);
      const answer = await peer.getAnswer(offer);
      socket.emit("peer-negotiation-done", { ans: answer, to: from });
    },
    [socket]
  );

  useEffect(() => {
    peer.peer.addEventListener("negotiationneeded", handlePeerNegotiation);
    return () => {
      peer.peer.removeEventListener("negotiationneeded", handlePeerNegotiation);
    };
  }, [handlePeerNegotiation]);

  useEffect(() => {
    console.log("🔹 Adding Track to Peer", peer.peer);

    peer.peer.addEventListener("track", async (ev) => {
      console.log("GOT TRACKS!!");
      const remoteStream = ev.streams;
      setRemoteStream(remoteStream[0]);
    });
  }, []);

  console.log(remoteStream);

  useEffect(() => {
    socket.on("user-joined", handleUserJoined);
    socket.on("incoming-call", handleIncomingCall);
    socket.on("call-accepted", handleCallAccepted);
    socket.on("peer-negotiation-needed", handleIncomingNegotiation);
    socket.on("peer-negotiation-final", handlePeerNegotiationFinal);
    return () => {
      socket.off("user-joined", handleUserJoined);
      socket.off("incoming-call", handleIncomingCall);
      socket.off("call-accepted", handleCallAccepted);
      socket.off("peer-negotiation-needed", handleIncomingNegotiation);
      socket.off("peer-negotiation-final", handlePeerNegotiationFinal);
    };
  }, [
    socket,
    handleUserJoined,
    handleIncomingCall,
    handleCallAccepted,
    handleIncomingNegotiation,
    handlePeerNegotiationFinal,
  ]);

  return (
    <div>
      <h1>Room Page</h1>
      <p>{remoteSocketId ? "Connected" : "No on in this Room"}</p>
      {setMyCameraStream && (
        <button
          className="border border-black px-6 py-1 rounded-b-xl mx-2 cursor-pointer"
          onClick={sendStream}
        >
          Send Stream
        </button>
      )}
      {remoteSocketId && (
        <button
          className="border border-black px-6 py-1 rounded-b-xl mx-2 cursor-pointer"
          onClick={handleCallUser}
        >
          Call
        </button>
      )}
      {remoteSocketId && (
        <button
          className="border border-black px-6 py-1 rounded-b-xl mx-2 cursor-pointer"
          onClick={toggleCamera}
        >
          {isCameraOn ? "Video On" : "Video Off"}
        </button>
      )}
      {remoteSocketId && (
        <button
          className="border border-black px-6 py-1 rounded-b-xl mx-2 cursor-pointer"
          onClick={toggleAudio}
        >
          {isAudioOn ? "Video On" : "Audio off"}
        </button>
      )}
      <button onClick={startScreenShare}>
        {isScreenSharing ? "Stop Screen Share" : "Share Screen"}
      </button>
      <div className="flex flex-col">
        {setMyCameraStream && (
          <ReactPlayer width={"400px"} url={myCameraStream} playing />
        )}
        {remoteStream && (
          <>
            <h1>Remote Stream</h1>
            <ReactPlayer
              playing
              muted={false}
              width="400px"
              url={remoteStream}
            />
          </>
        )}
        {myScreenStream && (
          <>
            <h3>Screen Share</h3>
            <ReactPlayer width={"400px"} url={myScreenStream} playing />
          </>
        )}
      </div>
    </div>
  );
}
