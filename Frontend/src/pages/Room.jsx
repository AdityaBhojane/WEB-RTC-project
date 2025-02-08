import { useCallback, useEffect, useState } from "react";
import { useSocket } from "../../context/socketProvider";
import ReactPlayer from "react-player";
import peer from "../service/peer";
import {Mic, MicOff,  PhoneOff,  ScreenShare, ScreenShareOff, Video, VideoOff} from 'lucide-react'

export default function Room() {
  const socket = useSocket();
  const [remoteSocketId, setRemoteSocketId] = useState("");
  const [isCameraOn, setIsCameraOn] = useState(true);
  const [isAudioOn, setIsAudioOn] = useState(true);
  const [myCameraStream, setMyCameraStream] = useState(null);
  const [myScreenStream, setMyScreenStream] = useState(null);
  const [remoteStreams, setRemoteStreams] = useState([]);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [isCallConnected, setIsCallConnected] = useState(false)

  const toggleCamera = async() => {
    if (myCameraStream) {
      const videoTrack = myCameraStream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setIsCameraOn(videoTrack.enabled);
      }
    }else{
      const cameraStream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: true,
        },
      });
  
      setMyCameraStream(cameraStream);
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
      const screenStream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: false,
      });
  
      setMyScreenStream(screenStream);
      setIsScreenSharing(true);
  
      // Add screen share track as a new track instead of replacing the camera track
      screenStream.getTracks().forEach((track) => {
        peer.peer.addTrack(track, screenStream);
      });
  
      screenStream.getVideoTracks()[0].onended = () => {
        stopScreenShare();
      };
    } else {
      stopScreenShare();
    }
  };
  

  const stopScreenShare = () => {
    if (myScreenStream) {
      myScreenStream.getTracks().forEach((track) => track.stop());
      setMyScreenStream(null);
      setIsScreenSharing(false);
  
      // Remove only the screen share track from peer connection
      const senders = peer.peer.getSenders();
      senders.forEach((sender) => {
        if (sender.track?.kind === "video" && sender.track.label.includes("screen")) {
          peer.peer.removeTrack(sender);
        }
      });
    }
  };
  



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

    const existingTracks = peer.peer
      .getSenders()
      .map((sender) => sender.track.id);

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

    // User joined the room
    const handleUserJoined = useCallback(({ email, id }) => {
      console.log(`${email} joined the room with id ${id}`);
      setRemoteSocketId(id);
      setIsCallConnected(true)
    }, []);

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
    }
  , [remoteSocketId, socket]);

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

  useEffect(()=>{
    if(isCallConnected){
        handleCallUser();
        setIsCallConnected(false)
    }
  },[handleCallUser, isCallConnected]);

  console.log(remoteStreams)

  return (
    <div className="w-full h-screen bg-gray-600 text-amber-50 pt-5 flex flex-col justify-center items-center pl-96" >
      <div className="w-full h-[85%] bg-[#161616] border border-white overflow-hidden">
        <div className="w-full h-full flex flex-wrap justify-center items-center gap-5 p-5 ">
          {myCameraStream && (
            <div className=" w-[40%] overflow-hidden custom-video">
            <ReactPlayer  width={"100%"} height={"100%"} playing muted url={myCameraStream} />
            </div>
          )}

          {isScreenSharing && myScreenStream && (
            <div className=" w-[40%]  overflow-hidden  custom-video">
              <ReactPlayer  width={"100%"} height={"100%"} playing muted url={myScreenStream} />
            </div>
          )}
          {/* max-w-[calc(100%/3-20px/3)] */}
          {remoteStreams.map((stream, index) => (
            <div
              key={index}
              className=" w-[40%]  overflow-hidden custom-video"
            >
              <ReactPlayer
                width={"100%"}
                height={"100%"}
                playing
                muted={false}
                url={stream}
              />
            </div>
          ))}
        </div>
        <p className="text-[#ccc] text-sm absolute right-0 border-0">{remoteSocketId ? "Connected" : "No on in this Room"}</p>
      </div>
      <div className="flex w-full h-[calc(100%-90%)] justify-center items-center gap-2">
        {/* {setMyCameraStream && (
          <button
            className="border border-black px-6 py-1 rounded-b-xl mx-2 cursor-pointer"
            onClick={sendStream}
          >
            Send Stream
          </button>
        )} */}
        {/* {remoteSocketId && (
          <button
            className="border border-black px-6 py-1 rounded-b-xl mx-2 cursor-pointer"
            onClick={handleCallUser}
          >
            Call
          </button>
        )} */}

          <button
            className={`cursor-pointer  p-4 ${isCameraOn? "bg-[#383838] hover:bg-[#2e2e2e]":"bg-white text-black"}  rounded-full transition-all`}
            onClick={toggleCamera}
          >
            {isCameraOn ?  <Video/>:<VideoOff/> }
          </button>

 
          <button
            className={`cursor-pointer  p-4 ${isAudioOn? "bg-[#383838] hover:bg-[#2e2e2e]":"bg-white text-black"}  rounded-full transition-all`}
            onClick={toggleAudio}
          >
            {isAudioOn ? <Mic/>:<MicOff/> }
          </button>

        <button
          onClick={startScreenShare}
          className={`cursor-pointer  p-4 ${!isScreenSharing? "bg-[#383838] hover:bg-[#2e2e2e]":"bg-white text-black"}  rounded-full transition-all`}
        >
          {isScreenSharing ? <ScreenShareOff/> : <ScreenShare/>}
        </button>
        <button
          onClick={()=>{}}
          className={`cursor-pointer p-4 bg-red-600  rounded-full transition-all`}
        >
          <PhoneOff/>
        </button>
      </div>
    </div>
  );
}
