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

  const verifiedFilter = {
    creatorId: user.id,
    paymentStatus: "verified",
  }

  const [summary, recentTips] = await prisma.$transaction([
    prisma.tip.aggregate({
      where: verifiedFilter,
      _sum: { amount: true },
      _avg: { amount: true },
      _count: { _all: true },
    }),
    prisma.tip.findMany({
      where: verifiedFilter,
      orderBy: { createdAt: "desc" },
      take: 20,
      select: {
        id: true,
        amount: true,
        currency: true,
        supporterName: true,
        message: true,
        paymentStatus: true,
        createdAt: true,
      },
    }),
  ])

  return Response.json({
    stats: {
      totalAmount: summary._sum.amount ?? 0,
      totalTips: summary._count._all,
      averageTip: Math.round(summary._avg.amount ?? 0),
    },
    recentTips,
  })
}
