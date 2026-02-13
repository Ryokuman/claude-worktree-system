import { NextResponse } from "next/server";
import { store } from "@/lib/store";

// GET /api/status - Full system status
export async function GET() {
  return NextResponse.json({
    active: store.getActive(),
    deactive: store.getDeactive(),
    ended: store.getEnded(),
  });
}
