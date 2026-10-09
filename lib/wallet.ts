import type { Prisma } from "@prisma/client"
import { db } from "@/lib/db"

type Tx = Prisma.TransactionClient

export class InsufficientBalanceError extends Error {
  code = "insufficient_balance"
  constructor(public balance: number, public required: number) {
    super("Insufficient wallet balance")
  }
}

const round = (n: number) => Math.round(n * 100) / 100

/**
 * Adds credit to a wallet and records the transaction. Pass `tx` to make it
 * part of a larger transaction.
 */
export async function creditWallet(
  input: { userId: string; amount: number; reason: string; reference?: string; note?: string },
  tx?: Tx
) {
  if (!(input.amount > 0)) throw new Error("Credit amount must be positive")
  const run = async (t: Tx) => {
    const user = await t.user.update({
      where: { id: input.userId },
      data: { walletBalance: { increment: round(input.amount) } },
      select: { walletBalance: true },
    })
    return t.walletTransaction.create({
      data: {
        userId: input.userId,
        type: "CREDIT",
        amount: round(input.amount),
        balanceAfter: round(user.walletBalance),
        reason: input.reason,
        reference: input.reference,
        note: input.note,
      },
    })
  }
  return tx ? run(tx) : db.$transaction(run)
}

/**
 * Takes money from a wallet, atomically: the balance never goes below zero
 * even with concurrent requests. Throws InsufficientBalanceError.
 */
export async function debitWallet(
  input: { userId: string; amount: number; reason: string; reference?: string; note?: string },
  tx?: Tx
) {
  if (!(input.amount > 0)) throw new Error("Debit amount must be positive")
  const amount = round(input.amount)
  const run = async (t: Tx) => {
    const updated = await t.user.updateMany({
      where: { id: input.userId, walletBalance: { gte: amount } },
      data: { walletBalance: { decrement: amount } },
    })
    if (updated.count === 0) {
      const user = await t.user.findUnique({ where: { id: input.userId }, select: { walletBalance: true } })
      throw new InsufficientBalanceError(user?.walletBalance ?? 0, amount)
    }
    const user = await t.user.findUniqueOrThrow({ where: { id: input.userId }, select: { walletBalance: true } })
    return t.walletTransaction.create({
      data: {
        userId: input.userId,
        type: "DEBIT",
        amount,
        balanceAfter: round(user.walletBalance),
        reason: input.reason,
        reference: input.reference,
        note: input.note,
      },
    })
  }
  return tx ? run(tx) : db.$transaction(run)
}
