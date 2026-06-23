import { getSession } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function GET() {
  const session = await getSession()
  if (!session?.userId) {
    return Response.json({ error: "Not authenticated" }, { status: 401 })
  }

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { id: true, fullName: true, creatorSlug: true },
  })

  if (!user) {
    return Response.json({ error: "User not found" }, { status: 404 })
  }

  const tips = await prisma.tip.findMany({
    where: { creatorId: user.id, paymentStatus: "verified" },
    orderBy: { createdAt: "desc" },
    take: 100,
  })

  const totalAmount = tips.reduce((sum, tip) => sum + tip.amount, 0)
  const totalSupporters = tips.length
  const averageTip = totalSupporters > 0 ? Math.round(totalAmount / totalSupporters) : 0

  return Response.json({
    stats: {
      totalAmount,
      totalSupporters,
      averageTip,
    },
    recentTips: tips.slice(0, 20),
  })
}
