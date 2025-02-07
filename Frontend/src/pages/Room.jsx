    import { useCallback, useEffect, useState } from "react";
    import { useSocket } from "../../context/socketProvider";
    import ReactPlayer from "react-player";
    import peer from "../service/peer";

    export default function Room() {
    const socket = useSocket();
    const [remoteSocketId, setRemoteSocketId] = useState("");
    const [isCameraOn, setIsCameraOn] = useState(true);
    const [isAudioOn, setIsAudioOn] = useState(true);
    const [myCameraStream, setMyCameraStream] = useState(null);
    const [myScreenStream, setMyScreenStream] = useState(null);
    const [remoteStreams, setRemoteStreams] = useState([]);
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
          // Start screen share
          const screenStream = await navigator.mediaDevices.getDisplayMedia({
            video: true,
            audio: false,
          });
      
          setMyScreenStream(screenStream);
          setIsScreenSharing(true);
      
          // Replace existing video track with screen track
          const videoSender = peer.peer.getSenders().find((s) => s.track?.kind === "video");
          if (videoSender) {
            videoSender.replaceTrack(screenStream.getVideoTracks()[0]);
          } else {
            peer.peer.addTrack(screenStream.getVideoTracks()[0], screenStream);
          }
      
          // Ensure screen sharing stops when the user clicks "Stop sharing"
          screenStream.getVideoTracks()[0].onended = () => {
            stopScreenShare();
          };
        } else {
          stopScreenShare();
        }
      };
      
      const stopScreenShare = () => {
        if (myScreenStream) {
          myScreenStream.getTracks().forEach((track) => track.stop()); // Stop all screen share tracks
          setMyScreenStream(null);
          setIsScreenSharing(false);
      
          // Revert to camera stream after stopping screen share
          if (myCameraStream) {
            const videoSender = peer.peer.getSenders().find((s) => s.track?.kind === "video");
            if (videoSender) {
              videoSender.replaceTrack(myCameraStream.getVideoTracks()[0]);
            }
          }
        }
      };
      
    
    


    // User joined the room
    const handleUserJoined = useCallback(({ email, id }) => {
        console.log(`${email} joined the room with id ${id}`);
        setRemoteSocketId(id);
    }, []);

    // User call a user
    const handleCallUser = useCallback(async () => {
        const cameraStream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: {
            echoCancellation: false,
            noiseSuppression: false,
            autoGainControl: true,
        },
        });
    
        setMyCameraStream(cameraStream);
    
        const existingTracks = peer.peer.getSenders().map((sender) => sender.track.id);
    
        cameraStream.getTracks().forEach((track) => {
        if (!existingTracks.includes(track.id)) {
            peer.peer.addTrack(track, cameraStream);
        }
        });
    
        const offer = await peer.createOffer();
        socket.emit("user-call", { offer, to: remoteSocketId });
    }, [remoteSocketId, socket]);
    

    // User received a call
    const handleIncomingCall = useCallback(
        async ({ offer, from }) => {
        setRemoteSocketId(from);

        // Get user's camera stream
        const cameraStream = await navigator.mediaDevices.getUserMedia({
            video: true,
            audio: {
            echoCancellation: false,
            noiseSuppression: false,
            autoGainControl: true,
            },
        });

        setMyCameraStream(cameraStream);

        // Check if screen share is active
        let screenStream = null;
        if (isScreenSharing) {
            screenStream = await navigator.mediaDevices.getDisplayMedia({
            video: true,
            audio: false,
            });
            setMyScreenStream(screenStream);
        }

        console.log("Incoming call from:", from, "Offer:", offer);

        const answer = await peer.getAnswer(offer);
        socket.emit("call-accepted", { to: from, ans: answer });

        // Send all active streams
        cameraStream.getTracks().forEach((track) => {
            peer.peer.addTrack(track, cameraStream);
        });

        if (screenStream) {
            screenStream.getTracks().forEach((track) => {
            peer.peer.addTrack(track, screenStream);
            });
        }
        },
        [socket, isScreenSharing]
    );

    //   //send stream
    //   const sendStream = useCallback(async () => {
    //     console.log("sending stream");
    //     for (const track of myStream.getTracks()) {
    //       peer.peer.addTrack(track, myStream);
    //     }
    //   }, [myStream]);

    const sendStream = useCallback(() => {
        if (myCameraStream) {
        myCameraStream.getTracks().forEach((track) => {
            peer.peer.addTrack(track, myCameraStream);
        });
        }
        if (myScreenStream) {
        myScreenStream.getTracks().forEach((track) => {
            peer.peer.addTrack(track, myScreenStream);
        });
        }
    }, [myCameraStream, myScreenStream]);

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
        peer.peer.addEventListener("track", (ev) => {
        console.log("GOT TRACK:", ev.streams);

        setRemoteStreams((prev) => {
            const existingStreamIds = prev.map((stream) => stream.id);
            const newStreams = ev.streams.filter(
            (stream) => !existingStreamIds.includes(stream.id)
            );
            return [...prev, ...newStreams];
        });
        });
    }, []);

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
            <h2>My Camera</h2>
            {myCameraStream && (
            <ReactPlayer width="400px" playing muted url={myCameraStream} />
            )}

            {isScreenSharing && myScreenStream && (
            <>
                <h2>My Screen Share</h2>
                <ReactPlayer width="400px" playing muted url={myScreenStream} />
            </>
            )}

            <h2>Remote Streams</h2>
            {remoteStreams.map((stream, index) => (
            <ReactPlayer
                key={index}
                width="400px"
                playing
                muted={false}
                url={stream}
            />
            ))}
        </div>
        </div>
    );
    }
