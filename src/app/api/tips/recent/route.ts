import { NextRequest } from "next/server"
import { prisma } from "@/lib/prisma"

export async function GET(request: NextRequest) {
  const slug = request.nextUrl.searchParams.get("slug")

  if (slug) {
    const creator = await prisma.user.findUnique({
      where: { creatorSlug: slug },
    })

    if (!creator) {
      return Response.json({ error: "Creator not found" }, { status: 404 })
    }

    const tips = await prisma.tip.findMany({
      where: { creatorId: creator.id, paymentStatus: "verified" },
      orderBy: { createdAt: "desc" },
      take: 50,
      select: {
        amount: true,
        supporterName: true,
        supporterEmail: true,
        message: true,
        createdAt: true,
        paymentStatus: true,
      },
    })

    return Response.json({ tips })
  }

  return Response.json({ tips: [] })
}
