"use client"

import { useQuery, useMutation } from "@tanstack/react-query"
import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"

type DashboardData = {
  stats: {
    totalAmount: number
    totalTips: number
    averageTip: number
  }
  recentTips: Array<{
    id: string
    amount: number
    currency: string
    supporterName: string | null
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

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(tipUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      setCopied(false)
    }
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
        <div className="max-w-5xl mx-auto px-4 py-3 sm:py-4 flex items-center justify-between gap-3">
          <h1 className="shrink-0 text-base sm:text-lg font-bold">
            <span className="sm:hidden">Hustle Receipt</span>
            <span className="hidden sm:inline">The Hustle Receipt</span>
          </h1>
          <div className="min-w-0 flex items-center justify-end gap-2 sm:gap-4">
            <span className="hidden min-w-0 truncate text-sm text-gray-500 min-[420px]:block">
              {userData?.user?.fullName}
            </span>
            <button
              onClick={() => logoutMutation.mutate()}
              className="inline-flex min-h-11 shrink-0 items-center whitespace-nowrap text-sm text-gray-500 hover:text-black transition-colors"
            >
              Log out
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-3 sm:px-4 py-5 sm:py-8 space-y-5 sm:space-y-8">
        <div className="bg-white border rounded-xl p-4 sm:p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold">Your tipping page</h2>
              <p className="text-sm text-gray-500 mt-1">
                Share this link with your audience
              </p>
            </div>
          </div>
          <div className="flex min-w-0 flex-col sm:flex-row sm:items-center gap-2">
            <input
              readOnly
              value={tipUrl}
              className="min-h-11 min-w-0 w-full flex-1 border rounded-lg px-3 py-2 text-base sm:text-sm bg-gray-50"
            />
            <button
              onClick={copyLink}
              className="inline-flex min-h-11 w-full sm:w-auto shrink-0 items-center justify-center whitespace-nowrap bg-black text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-800 transition-colors"
            >
              {copied ? "Copied!" : "Copy link"}
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 min-[480px]:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
          <div className="min-w-0 bg-white border rounded-xl p-4 sm:p-6 space-y-1">
            <p className="text-sm text-gray-500 font-medium">Total earned</p>
            <p className="truncate text-2xl sm:text-3xl font-bold">
              ₦{data?.stats?.totalAmount?.toLocaleString() || 0}
            </p>
          </div>
          <div className="min-w-0 bg-white border rounded-xl p-4 sm:p-6 space-y-1">
            <p className="text-sm text-gray-500 font-medium">Tips received</p>
            <p className="truncate text-2xl sm:text-3xl font-bold">
              {data?.stats?.totalTips || 0}
            </p>
          </div>
          <div className="min-w-0 bg-white border rounded-xl p-4 sm:p-6 space-y-1 min-[480px]:col-span-2 lg:col-span-1">
            <p className="text-sm text-gray-500 font-medium">Average tip</p>
            <p className="truncate text-2xl sm:text-3xl font-bold">
              ₦{data?.stats?.averageTip?.toLocaleString() || 0}
            </p>
          </div>
        </div>

        <div className="bg-white border rounded-xl">
          <div className="px-4 sm:px-6 py-4 border-b">
            <h3 className="font-semibold">Recent tips</h3>
          </div>
          {data?.recentTips && data.recentTips.length > 0 ? (
            <div className="divide-y">
              {data.recentTips.map((tip) => (
                <div
                  key={tip.id}
                  className="min-w-0 px-4 sm:px-6 py-4 flex flex-col min-[420px]:flex-row min-[420px]:items-start justify-between gap-2 sm:gap-4"
                >
                  <div className="min-w-0">
                    <p className="font-medium break-words">
                      {tip.supporterName || "Anonymous"}
                    </p>
                    {tip.message && (
                      <p className="text-sm text-gray-500 mt-0.5 break-words">
                        &ldquo;{tip.message}&rdquo;
                      </p>
                    )}
                  </div>
                  <div className="shrink-0 text-left min-[420px]:text-right">
                    <p className="font-semibold whitespace-nowrap">₦{tip.amount.toLocaleString()}</p>
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
            <div className="px-4 sm:px-6 py-10 sm:py-12 text-center text-gray-400">
              No tips yet. Share your tipping page to start receiving support.
            </div>
          )}
        </div>

        <div className="bg-white border rounded-xl">
          <div className="px-4 sm:px-6 py-4 border-b">
            <h3 className="font-semibold">Supporter messages</h3>
          </div>
          {data?.recentTips &&
          data.recentTips.some((t) => t.message) ? (
            <div className="divide-y">
              {data.recentTips
                .filter((t) => t.message)
                .map((tip) => (
                  <div key={tip.id} className="px-4 sm:px-6 py-4 min-w-0">
                    <p className="text-gray-800 italic break-words">
                      &ldquo;{tip.message}&rdquo;
                    </p>
                    <p className="text-sm text-gray-500 mt-1">
                      — {tip.supporterName || "Anonymous"}
                    </p>
                  </div>
                ))}
            </div>
          ) : (
            <div className="px-4 sm:px-6 py-10 sm:py-12 text-center text-gray-400">
              No messages from supporters yet.
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
