import Link from "next/link"

export default function HomePage() {
  return (
    <div className="flex flex-col min-h-screen">
      <header className="border-b bg-white">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between">
          <h1 className="text-xl font-bold tracking-tight">
            The Hustle Receipt
          </h1>
          <div className="flex items-center gap-3">
            <Link
              href="/login"
              className="text-sm font-medium text-gray-600 hover:text-black transition-colors"
            >
              Log in
            </Link>
            <Link
              href="/register"
              className="text-sm font-medium bg-black text-white px-4 py-2 rounded-lg hover:bg-gray-800 transition-colors"
            >
              Get started
            </Link>
          </div>
        </div>
      </header>

      <main className="flex-1 flex flex-col items-center justify-center px-4 py-16">
        <div className="max-w-2xl text-center space-y-6">
          <h2 className="text-4xl sm:text-5xl font-bold tracking-tight">
            Get paid for your
            <span className="text-yellow-500"> hustle</span>
          </h2>
          <p className="text-lg text-gray-600 max-w-lg mx-auto">
            The easiest way for your audience to support you directly. No
            platform fees, no middlemen.
          </p>
          <Link
            href="/register"
            className="inline-block bg-black text-white px-8 py-3 rounded-xl text-lg font-medium hover:bg-gray-800 transition-colors"
          >
            Start receiving tips
          </Link>
        </div>

        <div className="mt-20 grid grid-cols-1 sm:grid-cols-3 gap-6 w-full max-w-3xl">
          <div className="bg-white border rounded-xl p-6 text-center space-y-2">
            <div className="text-3xl">🎨</div>
            <h3 className="font-semibold">Create your page</h3>
            <p className="text-sm text-gray-500">
              Sign up and get your unique tipping page
            </p>
          </div>
          <div className="bg-white border rounded-xl p-6 text-center space-y-2">
            <div className="text-3xl">🔗</div>
            <h3 className="font-semibold">Share the link</h3>
            <p className="text-sm text-gray-500">
              Share your page with your audience
            </p>
          </div>
          <div className="bg-white border rounded-xl p-6 text-center space-y-2">
            <div className="text-3xl">💰</div>
            <h3 className="font-semibold">Get supported</h3>
            <p className="text-sm text-gray-500">
              Receive tips directly via Flutterwave
            </p>
          </div>
        </div>
      </main>

      <footer className="border-t bg-white py-6 text-center text-sm text-gray-500">
        &copy; {new Date().getFullYear()} The Hustle Receipt
      </footer>
    </div>
  )
}
