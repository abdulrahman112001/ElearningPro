import { Server as NetServer } from "http"
import { NextApiRequest, NextApiResponse } from "next"
import { Server as ServerIO } from "socket.io"
import { getToken } from "next-auth/jwt"

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

    io.on("connection", async (socket) => {
      // Authenticate the socket using the NextAuth session cookie instead of
      // trusting a client-supplied userId (which could be spoofed).
      let userId: string | undefined
      try {
        const token = await getToken({
          req: {
            headers: { cookie: socket.handshake.headers.cookie || "" },
          } as any,
          secret:
            process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET || "",
        })
        userId = (token?.id as string | undefined) ?? undefined
      } catch {
        userId = undefined
      }

      if (!userId) {
        socket.disconnect(true)
        return
      }

      socket.join(userId)
      console.log(`User ${userId} connected`)

      socket.on("send-message", (message) => {
        const { toUserId } = message
        if (toUserId) {
          // Bind the sender identity to the authenticated user.
          io.to(toUserId).emit("new-message", { ...message, fromUserId: userId })
        }
      })

      socket.on("mark-as-read", ({ partnerId }) => {
        if (partnerId) {
          io.to(partnerId).emit("messages-read", { by: userId })
        }
      })

      socket.on("typing", ({ toUserId }) => {
        if (toUserId) {
          io.to(toUserId).emit("user-typing", { userId })
        }
      })

      socket.on("stop-typing", ({ toUserId }) => {
        if (toUserId) {
          io.to(toUserId).emit("user-stop-typing", { userId })
        }
      })

      socket.on("disconnect", () => {
        console.log(`User ${userId} disconnected`)
      })
    })

    res.socket.server.io = io
  }

  res.end()
}

export default ioHandler
