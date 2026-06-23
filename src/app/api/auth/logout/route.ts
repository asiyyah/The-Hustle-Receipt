import { deleteSession } from "@/lib/auth"

export async function POST() {
  await deleteSession()
  return Response.json({ success: true })
}
