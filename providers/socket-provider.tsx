"use client"

import { createContext, useContext, useEffect, useState } from "react"
import { io, Socket } from "socket.io-client"
import { useSession } from "next-auth/react"

interface SocketContextType {
  socket: Socket | null
  isConnected: boolean
}

const SocketContext = createContext<SocketContextType>({
  socket: null,
  isConnected: false,
})

export function useSocket() {
  return useContext(SocketContext)
}

export function SocketProvider({ children }: { children: React.ReactNode }) {
  const { data: session } = useSession()
  const [socket, setSocket] = useState<Socket | null>(null)
  const [isConnected, setIsConnected] = useState(false)

  useEffect(() => {
    if (!session?.user?.id) {
      return
    }

    const socketInstance = io(process.env.NEXT_PUBLIC_SOCKET_URL || "", {
      path: "/api/socket/io",
      addTrailingSlash: false,
      auth: {
        userId: session.user.id,
      },
    })

    socketInstance.on("connect", () => {
      console.log("Socket connected")
      setIsConnected(true)
    })

    socketInstance.on("disconnect", () => {
      console.log("Socket disconnected")
      setIsConnected(false)
    })

    setSocket(socketInstance)

    return () => {
      socketInstance.disconnect()
    }
  }, [session?.user?.id])

  return (
    <SocketContext.Provider value={{ socket, isConnected }}>
      {children}
    </SocketContext.Provider>
  )
}
