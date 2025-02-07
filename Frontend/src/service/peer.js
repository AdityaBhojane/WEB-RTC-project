class PeerService {

  constructor() {
    if (!this.peer) {
      this.peer = new RTCPeerConnection({
        iceServers: [
          {
            urls: [
              "stun:stun.l.google.com:19302",
              "stun:global.stun.twilio.com:3478",
            ],
          },
        ],
      });
      console.log("🆕 Created New Peer Connection", this.peer);
    }else{
        console.log("♻️ Using Existing Peer", this.peer);
    }
  };

  // get offer
  async createOffer() {
    const offer = await this.peer.createOffer();
    await this.peer.setLocalDescription(new RTCSessionDescription(offer));
    return offer;
  };

  async getAnswer(offer) {
    if (this.peer) {
      // try new RTCSessionDescription(offer)
      await this.peer.setRemoteDescription(offer);
      const answer = await this.peer.createAnswer();
      await this.peer.setLocalDescription(new RTCSessionDescription(answer));
      return answer;
    }
  };

  // setLocalDescription
  async setAnswer(answer) {
    if (this.peer) {
      await this.peer.setRemoteDescription(answer);
    }
  };


};

export default new PeerService();
