import { Server as NetServer } from "http"
import { NextApiRequest, NextApiResponse } from "next"
import { Server as ServerIO } from "socket.io"

export const config = {
  api: {
    bodyParser: false,
  },
}

type NextApiResponseServerIO = NextApiResponse & {
  socket: {
    server: NetServer & {
      io?: ServerIO
    }
  }
}

const ioHandler = (req: NextApiRequest, res: NextApiResponseServerIO) => {
  if (!res.socket.server.io) {
    const path = "/api/socket/io"
    const httpServer: NetServer = res.socket.server as any
    const io = new ServerIO(httpServer, {
      path: path,
      addTrailingSlash: false,
      cors: {
        origin: process.env.NEXT_PUBLIC_APP_URL || "*",
        methods: ["GET", "POST"],
        credentials: true,
      },
    })

    io.on("connection", (socket) => {
      const userId = socket.handshake.auth.userId

      if (userId) {
        socket.join(userId)
        console.log(`User ${userId} connected`)
      }

      socket.on("send-message", (message) => {
        const { toUserId } = message
        if (toUserId) {
          io.to(toUserId).emit("new-message", message)
        }
      })

      socket.on("mark-as-read", ({ partnerId }) => {
        if (userId && partnerId) {
          io.to(partnerId).emit("messages-read", { by: userId })
        }
      })

      socket.on("typing", ({ toUserId }) => {
        if (userId && toUserId) {
          io.to(toUserId).emit("user-typing", { userId })
        }
      })

      socket.on("stop-typing", ({ toUserId }) => {
        if (userId && toUserId) {
          io.to(toUserId).emit("user-stop-typing", { userId })
        }
      })

      socket.on("disconnect", () => {
        if (userId) {
          console.log(`User ${userId} disconnected`)
        }
      })
    })

    res.socket.server.io = io
  }

  res.end()
}

export default ioHandler
