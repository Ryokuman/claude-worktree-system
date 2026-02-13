import { NextResponse } from "next/server";
import { listPlanFiles, writePlanFile } from "@/lib/plan-manager";

// GET /api/plan/[branch] - List plan files (A11)
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ branch: string }> }
) {
  const { branch } = await params;
  const decodedBranch = decodeURIComponent(branch);
  const files = listPlanFiles(decodedBranch);
  return NextResponse.json(files);
}

// PUT /api/plan/[branch] - Update plan file (A12)
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ branch: string }> }
) {
  try {
    const { branch } = await params;
    const decodedBranch = decodeURIComponent(branch);
    const { filename, content } = await request.json();

    if (!filename || content === undefined) {
      return NextResponse.json(
        { error: "filename and content are required" },
        { status: 400 }
      );
    }

    writePlanFile(decodedBranch, filename, content);
    return NextResponse.json({ status: "updated", filename });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
