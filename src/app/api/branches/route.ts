import { NextResponse } from "next/server";
import { store } from "@/lib/store";

// GET /api/branches - List deactive branches
export async function GET() {
  const deactive = store.getDeactive();
  return NextResponse.json(deactive);
}
