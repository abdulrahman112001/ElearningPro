"use client"

import { useState, useEffect, useRef } from "react"
import { useTranslations } from "next-intl"
import { useSession } from "next-auth/react"
import { useSocket } from "@/providers/socket-provider"
import { formatDistanceToNow } from "date-fns"
import { ar } from "date-fns/locale"
import {
  Search,
  Send,
  Loader2,
  User,
  MessageSquare,
  ArrowRight,
} from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { ScrollArea } from "@/components/ui/scroll-area"
import { cn } from "@/lib/utils"

interface Student {
  id: string
  name: string | null
  email: string | null
  image: string | null
}

interface Message {
  id: string
  content: string
  fromUserId: string
  toUserId: string
  createdAt: string
  isRead: boolean
  fromUser: {
    id: string
    name: string | null
    image: string | null
  }
}

interface Conversation {
  partnerId: string
  partner: Student
  lastMessage?: Message
  unreadCount: number
}

export function MessagesInterface() {
  const t = useTranslations("instructor")
  const { data: session } = useSession()
  const { socket, isConnected } = useSocket()

  const [students, setStudents] = useState<Student[]>([])
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [selectedPartner, setSelectedPartner] = useState<Student | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [newMessage, setNewMessage] = useState("")
  const [search, setSearch] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [isSending, setIsSending] = useState(false)
  const [showMobileChat, setShowMobileChat] = useState(false)

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Fetch students
  useEffect(() => {
    const fetchStudents = async () => {
      try {
        const res = await fetch(`/api/messages/students?search=${search}`)
        const data = await res.json()
        setStudents(data.students || [])
      } catch (error) {
        console.error("Error fetching students:", error)
      }
    }
    fetchStudents()
  }, [search])

  // Fetch messages when partner selected
  useEffect(() => {
    if (!selectedPartner) return

    const fetchMessages = async () => {
      setIsLoading(true)
      try {
        const res = await fetch(`/api/messages/${selectedPartner.id}`)
        const data = await res.json()
        setMessages(data.messages || [])
      } catch (error) {
        console.error("Error fetching messages:", error)
      } finally {
        setIsLoading(false)
      }
    }
    fetchMessages()
  }, [selectedPartner])

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  // Socket listeners
  useEffect(() => {
    if (!socket) return

    const handleNewMessage = (message: Message) => {
      if (
        (message.fromUserId === selectedPartner?.id &&
          message.toUserId === session?.user?.id) ||
        (message.fromUserId === session?.user?.id &&
          message.toUserId === selectedPartner?.id)
      ) {
        setMessages((prev) => [...prev, message])
      }
    }

    socket.on("new-message", handleNewMessage)

    return () => {
      socket.off("new-message", handleNewMessage)
    }
  }, [socket, selectedPartner, session?.user?.id])

  const handleSendMessage = async () => {
    if (!newMessage.trim() || !selectedPartner || isSending) return

    setIsSending(true)
    try {
      const res = await fetch(`/api/messages/${selectedPartner.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: newMessage.trim() }),
      })

      if (res.ok) {
        const message = await res.json()
        setMessages((prev) => [...prev, message])
        setNewMessage("")

        // Emit via socket
        if (socket) {
          socket.emit("send-message", {
            ...message,
            toUserId: selectedPartner.id,
          })
        }
      }
    } catch (error) {
      console.error("Error sending message:", error)
    } finally {
      setIsSending(false)
    }
  }

  const handleSelectPartner = (student: Student) => {
    setSelectedPartner(student)
    setShowMobileChat(true)
    inputRef.current?.focus()
  }

  const handleBackToList = () => {
    setShowMobileChat(false)
    setSelectedPartner(null)
  }

  return (
    <div className="flex h-[calc(100vh-200px)] min-h-[500px] border rounded-lg overflow-hidden bg-background">
      {/* Sidebar - Contacts */}
      <div
        className={cn(
          "w-full md:w-80 border-e flex flex-col",
          showMobileChat && "hidden md:flex"
        )}
      >
        {/* Search */}
        <div className="p-4 border-b">
          <div className="relative">
            <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder={t("searchStudents")}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="ps-9"
            />
          </div>
        </div>

        {/* Students List */}
        <ScrollArea className="flex-1">
          {students.length === 0 ? (
            <div className="text-center py-12 px-4">
              <User className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">{t("noStudents")}</p>
            </div>
          ) : (
            <div className="divide-y">
              {students.map((student) => (
                <button
                  key={student.id}
                  onClick={() => handleSelectPartner(student)}
                  className={cn(
                    "w-full p-4 flex items-center gap-3 hover:bg-muted/50 transition-colors text-start",
                    selectedPartner?.id === student.id && "bg-muted"
                  )}
                >
                  <Avatar>
                    <AvatarImage src={student.image || undefined} />
                    <AvatarFallback>
                      {student.name?.charAt(0) || "U"}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">
                      {student.name || t("anonymous")}
                    </p>
                    <p className="text-sm text-muted-foreground truncate">
                      {student.email}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </ScrollArea>
      </div>

      {/* Chat Area */}
      <div
        className={cn(
          "flex-1 flex flex-col",
          !showMobileChat && "hidden md:flex"
        )}
      >
        {selectedPartner ? (
          <>
            {/* Chat Header */}
            <div className="p-4 border-b flex items-center gap-3">
              <Button
                variant="ghost"
                size="icon"
                className="md:hidden"
                onClick={handleBackToList}
              >
                <ArrowRight className="h-5 w-5" />
              </Button>
              <Avatar>
                <AvatarImage src={selectedPartner.image || undefined} />
                <AvatarFallback>
                  {selectedPartner.name?.charAt(0) || "U"}
                </AvatarFallback>
              </Avatar>
              <div>
                <p className="font-medium">
                  {selectedPartner.name || t("anonymous")}
                </p>
                <p className="text-sm text-muted-foreground">
                  {selectedPartner.email}
                </p>
              </div>
              {isConnected && (
                <span className="ms-auto text-xs text-green-500 flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-green-500" />
                  {t("online") || "متصل"}
                </span>
              )}
            </div>

            {/* Messages */}
            <ScrollArea className="flex-1 p-4">
              {isLoading ? (
                <div className="flex items-center justify-center h-full">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : messages.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-center">
                  <MessageSquare className="h-12 w-12 text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">
                    {t("startConversation") || "ابدأ المحادثة بإرسال رسالة"}
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {messages.map((message) => (
                    <div
                      key={message.id}
                      className={cn(
                        "flex",
                        message.fromUserId === session?.user?.id
                          ? "justify-end"
                          : "justify-start"
                      )}
                    >
                      <div
                        className={cn(
                          "max-w-[70%] rounded-lg px-4 py-2",
                          message.fromUserId === session?.user?.id
                            ? "bg-primary text-primary-foreground"
                            : "bg-muted"
                        )}
                      >
                        <p className="whitespace-pre-wrap break-words">
                          {message.content}
                        </p>
                        <p
                          className={cn(
                            "text-xs mt-1",
                            message.fromUserId === session?.user?.id
                              ? "text-primary-foreground/70"
                              : "text-muted-foreground"
                          )}
                        >
                          {formatDistanceToNow(new Date(message.createdAt), {
                            addSuffix: true,
                            locale: ar,
                          })}
                        </p>
                      </div>
                    </div>
                  ))}
                  <div ref={messagesEndRef} />
                </div>
              )}
            </ScrollArea>

            {/* Input */}
            <div className="p-4 border-t">
              <form
                onSubmit={(e) => {
                  e.preventDefault()
                  handleSendMessage()
                }}
                className="flex gap-2"
              >
                <Input
                  ref={inputRef}
                  placeholder={t("typeMessage") || "اكتب رسالتك..."}
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  disabled={isSending}
                />
                <Button
                  type="submit"
                  disabled={!newMessage.trim() || isSending}
                >
                  {isSending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                </Button>
              </form>
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-4">
            <MessageSquare className="h-16 w-16 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">
              {t("selectConversation") || "اختر محادثة"}
            </h3>
            <p className="text-muted-foreground">
              {t("selectConversationDescription") ||
                "اختر طالب من القائمة لبدء المحادثة"}
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
