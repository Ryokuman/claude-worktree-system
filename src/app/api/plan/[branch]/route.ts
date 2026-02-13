import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { listPlanFiles } from "@/lib/plan-manager";

const PLAN_DIR = path.resolve(process.cwd(), "plan");

/**
 * GET /api/plan/:branch
 *
 * 해당 브랜치의 플랜 파일 목록과 내용을 반환한다. (A11)
 *
 * Params: branch - 브랜치명 (URL encoded)
 *
 * Response 200: PlanFile[] { name, path, content, updatedAt }
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ branch: string }> }
) {
  const { branch } = await params;
  const decodedBranch = decodeURIComponent(branch);
  const files = listPlanFiles(decodedBranch);
  return NextResponse.json(files);
}

/**
 * PUT /api/plan/:branch
 *
 * 플랜 파일 내용을 수정한다. (A12)
 *
 * Params: branch - 브랜치명 (URL encoded)
 * Body: { filename: string, content: string }
 *
 * Response 200: { status: "updated", filename: string }
 * Response 400: { error: "filename and content are required" }
 * Response 500: { error: string }
 */
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

    const dir = path.join(PLAN_DIR, "active", decodedBranch);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, filename), content, "utf-8");

    return NextResponse.json({ status: "updated", filename });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
