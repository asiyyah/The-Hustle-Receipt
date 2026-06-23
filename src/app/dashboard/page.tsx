"use client"

import { useQuery, useMutation } from "@tanstack/react-query"
import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"

type DashboardData = {
  stats: {
    totalAmount: number
    totalSupporters: number
    averageTip: number
  }
  recentTips: Array<{
    id: string
    amount: number
    currency: string
    supporterName: string | null
    supporterEmail: string
    message: string | null
    paymentStatus: string
    createdAt: string
  }>
}

type UserData = {
  user: {
    id: string
    fullName: string
    email: string
    creatorSlug: string
    avatar: string | null
    bio: string | null
  }
}

async function fetchDashboard(): Promise<DashboardData> {
  const res = await fetch("/api/dashboard/stats")
  if (!res.ok) throw new Error("Not authenticated")
  return res.json()
}

async function fetchUser(): Promise<UserData> {
  const res = await fetch("/api/auth/me")
  if (!res.ok) throw new Error("Not authenticated")
  return res.json()
}

async function logout() {
  await fetch("/api/auth/logout", { method: "POST" })
}

export default function DashboardPage() {
  const router = useRouter()
  const [copied, setCopied] = useState(false)

  const { data: userData, isLoading: userLoading } = useQuery({
    queryKey: ["user"],
    queryFn: fetchUser,
    retry: false,
  })

  const { data, isLoading, error } = useQuery({
    queryKey: ["dashboard"],
    queryFn: fetchDashboard,
    retry: false,
  })

  const logoutMutation = useMutation({
    mutationFn: logout,
    onSuccess: () => {
      router.push("/login")
      router.refresh()
    },
  })

  useEffect(() => {
    if (error) {
      router.push("/login")
    }
  }, [error, router])

  const creatorSlug = userData?.user?.creatorSlug
  const tipUrl = creatorSlug
    ? `${window.location.origin}/tip/${creatorSlug}`
    : ""

  function copyLink() {
    navigator.clipboard.writeText(tipUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  if (isLoading || userLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-pulse text-gray-400">Loading dashboard...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between">
          <h1 className="text-lg font-bold">The Hustle Receipt</h1>
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-500">
              {userData?.user?.fullName}
            </span>
            <button
              onClick={() => logoutMutation.mutate()}
              className="text-sm text-gray-500 hover:text-black transition-colors"
            >
              Log out
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-8 space-y-8">
        <div className="bg-white border rounded-xl p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold">Your tipping page</h2>
              <p className="text-sm text-gray-500 mt-1">
                Share this link with your audience
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <input
              readOnly
              value={tipUrl}
              className="flex-1 border rounded-lg px-3 py-2 text-sm bg-gray-50"
            />
            <button
              onClick={copyLink}
              className="bg-black text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-800 transition-colors whitespace-nowrap"
            >
              {copied ? "Copied!" : "Copy link"}
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-white border rounded-xl p-6 space-y-1">
            <p className="text-sm text-gray-500 font-medium">Total earned</p>
            <p className="text-3xl font-bold">
              ₦{data?.stats?.totalAmount?.toLocaleString() || 0}
            </p>
          </div>
          <div className="bg-white border rounded-xl p-6 space-y-1">
            <p className="text-sm text-gray-500 font-medium">Supporters</p>
            <p className="text-3xl font-bold">
              {data?.stats?.totalSupporters || 0}
            </p>
          </div>
          <div className="bg-white border rounded-xl p-6 space-y-1">
            <p className="text-sm text-gray-500 font-medium">Average tip</p>
            <p className="text-3xl font-bold">
              ₦{data?.stats?.averageTip?.toLocaleString() || 0}
            </p>
          </div>
        </div>

        <div className="bg-white border rounded-xl">
          <div className="px-6 py-4 border-b">
            <h3 className="font-semibold">Recent tips</h3>
          </div>
          {data?.recentTips && data.recentTips.length > 0 ? (
            <div className="divide-y">
              {data.recentTips.map((tip) => (
                <div
                  key={tip.id}
                  className="px-6 py-4 flex items-center justify-between"
                >
                  <div>
                    <p className="font-medium">
                      {tip.supporterName || "Anonymous"}
                    </p>
                    {tip.message && (
                      <p className="text-sm text-gray-500 mt-0.5">
                        &ldquo;{tip.message}&rdquo;
                      </p>
                    )}
                  </div>
                  <div className="text-right">
                    <p className="font-semibold">₦{tip.amount.toLocaleString()}</p>
                    <p className="text-xs text-green-600 font-medium">
                      {tip.paymentStatus === "verified"
                        ? "Successful"
                        : tip.paymentStatus}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="px-6 py-12 text-center text-gray-400">
              No tips yet. Share your tipping page to start receiving support.
            </div>
          )}
        </div>

        <div className="bg-white border rounded-xl">
          <div className="px-6 py-4 border-b">
            <h3 className="font-semibold">Supporter messages</h3>
          </div>
          {data?.recentTips &&
          data.recentTips.some((t) => t.message) ? (
            <div className="divide-y">
              {data.recentTips
                .filter((t) => t.message)
                .map((tip) => (
                  <div key={tip.id} className="px-6 py-4">
                    <p className="text-gray-800 italic">
                      &ldquo;{tip.message}&rdquo;
                    </p>
                    <p className="text-sm text-gray-500 mt-1">
                      — {tip.supporterName || "Anonymous"}
                    </p>
                  </div>
                ))}
            </div>
          ) : (
            <div className="px-6 py-12 text-center text-gray-400">
              No messages from supporters yet.
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
