import NextAuth from "next-auth"
import type { Adapter } from "next-auth/adapters"
import { PrismaAdapter } from "@auth/prisma-adapter"
import Credentials from "next-auth/providers/credentials"
import { CredentialsSignin } from "next-auth"
import Google from "next-auth/providers/google"
import GitHub from "next-auth/providers/github"
import bcrypt from "bcryptjs"
import { db } from "@/lib/db"
import { UserRole } from "@prisma/client"
import { isLocked, recordFailure, resetLimit } from "@/lib/rate-limit"
import { logActivity } from "@/lib/activity"

// Brute-force protection: 10 failed passwords per account per 15 minutes.
const LOGIN_SCOPE = "login-failures"
const LOGIN_MAX_FAILURES = 10
const LOGIN_WINDOW_MS = 15 * 60 * 1000

// Expected login failures must be CredentialsSignin errors: NextAuth v5
// reports any other thrown error as "Configuration", which made the login
// page unable to tell a wrong password from a server/database outage.
// The code is sent to the client as `result.code`.
class InvalidCredentials extends CredentialsSignin {
  code = "invalid_credentials"
}
class AccountBlocked extends CredentialsSignin {
  code = "account_blocked"
}
class TooManyAttempts extends CredentialsSignin {
  code = "too_many_attempts"
}

export const { handlers, signIn, signOut, auth } = NextAuth({
  adapter: PrismaAdapter(db) as Adapter,
  session: { strategy: "jwt" },
  // v5 expects AUTH_SECRET; fall back to legacy NEXTAUTH_SECRET so both work
  secret: process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET,
  // Required on Vercel / proxied hosts so v5 can build absolute callback URLs
  trustHost: true,
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
          throw new InvalidCredentials()
        }

        const email = (credentials.email as string).trim().toLowerCase()

        if (isLocked(LOGIN_SCOPE, email, LOGIN_MAX_FAILURES)) {
          throw new TooManyAttempts()
        }

        const user = await db.user.findFirst({
          where: { email: { equals: email, mode: "insensitive" } },
        })

        if (!user || !user.password) {
          recordFailure(LOGIN_SCOPE, email, LOGIN_WINDOW_MS)
          throw new InvalidCredentials()
        }

        const isPasswordValid = await bcrypt.compare(
          credentials.password as string,
          user.password
        )

        if (!isPasswordValid) {
          recordFailure(LOGIN_SCOPE, email, LOGIN_WINDOW_MS)
          throw new InvalidCredentials()
        }

        resetLimit(LOGIN_SCOPE, email)

        if (user.isBlocked) {
          throw new AccountBlocked()
        }

        await logActivity({
          actorId: user.id,
          actorRole: user.role,
          action: "user.login",
          entityType: "user",
          entityId: user.id,
          summary: `${user.email} signed in`,
        })

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
    async redirect({ url, baseUrl }) {
      // Allow redirects to the same origin or to our production URL
      if (url.startsWith("/")) return `${baseUrl}${url}`
      if (url.startsWith(baseUrl)) return url
      if (url.startsWith("https://elearning-pro-pearl.vercel.app")) return url
      return baseUrl
    },
    async jwt({ token, user, trigger, session }) {
      if (user) {
        token.id = user.id as string
        token.role = (user as any).role || UserRole.STUDENT
      }
      if (token.id) {
        // Re-check the account on every request so that blocking a user,
        // changing their role or approving an instructor takes effect
        // immediately, not when the JWT expires. Returning null ends the
        // session.
        const current = await db.user.findUnique({
          where: { id: token.id as string },
          select: {
            role: true,
            isBlocked: true,
            instructorProfile: { select: { isApproved: true } },
          },
        })
        if (!current || current.isBlocked) return null
        token.role = current.role
        token.instructorApproved =
          current.role !== UserRole.INSTRUCTOR ||
          current.instructorProfile?.isApproved === true
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
        session.user.instructorApproved = token.instructorApproved !== false
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
