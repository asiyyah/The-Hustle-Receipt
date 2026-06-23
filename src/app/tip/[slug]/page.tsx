import { prisma } from "@/lib/prisma"
import { notFound } from "next/navigation"
import { TipPageClient } from "./client"

export default async function TipPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params

  const creator = await prisma.user.findUnique({
    where: { creatorSlug: slug },
    select: {
      id: true,
      fullName: true,
      avatar: true,
      bio: true,
      twitter: true,
      instagram: true,
      creatorSlug: true,
    },
  })

  if (!creator) {
    notFound()
  }

  const tips = await prisma.tip.findMany({
    where: { creatorId: creator.id, paymentStatus: "verified" },
    orderBy: { createdAt: "desc" },
    take: 20,
    select: {
      amount: true,
      supporterName: true,
      message: true,
      createdAt: true,
    },
  })

  return <TipPageClient creator={creator} tips={tips} />
}
