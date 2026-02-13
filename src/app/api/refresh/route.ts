import { NextResponse } from "next/server";
import { classifyBranches } from "@/lib/classifier";
import { fetchAll } from "@/lib/git";

// POST /api/refresh - Manual git refresh
export async function POST() {
  try {
    fetchAll();
    classifyBranches();
    return NextResponse.json({ status: "refreshed" });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
