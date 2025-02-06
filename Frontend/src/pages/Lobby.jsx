import { useCallback, useEffect, useState } from "react";
import { useSocket } from "../../context/socketProvider";


export default function Lobby() {
    const [email, setEmail] = useState('');
    const [room, setRoom] = useState('');
    const socket = useSocket();

    console.log(socket)

    const handleSubmit = useCallback((e)=>{
        e.preventDefault();
        socket.emit('join-room', {email, room});
        
    },[email, room, socket]);

    useEffect(() => {
        socket.on('join-room', (data) => {
            console.log("Data From BE",data);
        })
    },[socket])

  return (
    <div>
        <h1>Lobby</h1>
        <form onSubmit={handleSubmit}>
            <label htmlFor="email">Email</label>
            <input 
            type="text" 
            name="email" 
            id="email" 
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="border border-black px-4 py-1 rounded-xl"/>
            <br />
            <label htmlFor="room">Room Id</label>
            <input 
            type="text" 
            name="room" 
            id="room" 
            value={room}
            onChange={(e) => setRoom(e.target.value)}
            className="border border-black px-4 py-1 rounded-xl"/>
            <br />
            <button type="submit" className="border border-black px-4 py-1 rounded-xl">Join</button>
        </form>
    </div>
  )
}
