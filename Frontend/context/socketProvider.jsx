import { createContext, useContext } from "react";
import { io } from 'socket.io-client';

const socketContext = createContext();

// eslint-disable-next-line react-refresh/only-export-components
export const useSocket = () => {
    const socket = useContext(socketContext);
    return socket;
};

// eslint-disable-next-line react/prop-types
export const SocketProvider = ({children}) => {
    const socket = io('http://localhost:8000');

    return (
        <socketContext.Provider value={socket}>
            {children}
        </socketContext.Provider>
    )
 };

