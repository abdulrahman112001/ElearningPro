import NextAuth from "next-auth"
import { PrismaAdapter } from "@auth/prisma-adapter"
import Credentials from "next-auth/providers/credentials"
import Google from "next-auth/providers/google"
import GitHub from "next-auth/providers/github"
import bcrypt from "bcryptjs"
import { db } from "@/lib/db"
import { UserRole } from "@prisma/client"

export const { handlers, signIn, signOut, auth } = NextAuth({
  adapter: PrismaAdapter(db),
  session: { strategy: "jwt" },
  pages: {
    signIn: "/login",
    error: "/login",
  },
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
    GitHub({
      clientId: process.env.GITHUB_CLIENT_ID!,
      clientSecret: process.env.GITHUB_CLIENT_SECRET!,
    }),
    Credentials({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          throw new Error("Invalid credentials")
        }

        const user = await db.user.findUnique({
          where: { email: credentials.email as string },
        })

        if (!user || !user.password) {
          throw new Error("Invalid credentials")
        }

        const isPasswordValid = await bcrypt.compare(
          credentials.password as string,
          user.password
        )

        if (!isPasswordValid) {
          throw new Error("Invalid credentials")
        }

        if (user.isBlocked) {
          throw new Error("Your account has been blocked")
        }

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          image: user.image,
          role: user.role,
        }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user, trigger, session }) {
      if (user) {
        token.id = user.id
        token.role = (user as any).role || UserRole.STUDENT
      }

      if (trigger === "update" && session) {
        token.name = session.name
        token.image = session.image
      }

      return token
    },
    async session({ session, token }) {
      if (token) {
        session.user.id = token.id as string
        session.user.role = token.role as UserRole
      }
      return session
    },
    async signIn({ user, account }) {
      if (account?.provider !== "credentials") {
        const existingUser = await db.user.findUnique({
          where: { email: user.email! },
        })

        if (existingUser?.isBlocked) {
          return false
        }
      }
      return true
    },
  },
  events: {
    async createUser({ user }) {
      // Create subscription for new user
      await db.subscription.create({
        data: {
          userId: user.id!,
          plan: "FREE",
          status: "ACTIVE",
        },
      })
    },
  },
})
