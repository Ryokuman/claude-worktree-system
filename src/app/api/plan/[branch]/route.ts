import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { readPlanJson, listPlanFiles } from "@/lib/plan-manager";
import type { PlanJson } from "@/lib/types";

const PLAN_DIR = path.resolve(process.cwd(), "plan");

/**
 * GET /api/plan/:branch
 *
 * 해당 브랜치의 플랜 데이터를 반환한다.
 * - plan.json 있음 → { type: "structured", plan, files }
 * - plan.json 없고 파일 있음 → { type: "raw", files }
 * - 아무것도 없음 → { type: "empty" }
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ branch: string }> },
) {
  const { branch } = await params;
  const decodedBranch = decodeURIComponent(branch);
  const plan = readPlanJson(decodedBranch);
  const files = listPlanFiles(decodedBranch);

  if (plan) {
    return NextResponse.json({ type: "structured", plan, files });
  }
  if (files.length > 0) {
    return NextResponse.json({ type: "raw", files });
  }
  return NextResponse.json({ type: "empty" });
}

/**
 * PUT /api/plan/:branch
 *
 * 플랜 파일 내용을 수정한다.
 * Body: { filename: string, content: string }
 */
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ branch: string }> },
) {
  try {
    const { branch } = await params;
    const decodedBranch = decodeURIComponent(branch);
    const { filename, content } = await request.json();

    if (!filename || content === undefined) {
      return NextResponse.json(
        { error: "filename and content are required" },
        { status: 400 },
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

/**
 * PATCH /api/plan/:branch
 *
 * step의 status를 변경한다.
 * Body: { stepId: string, status: "pending" | "in_progress" | "done" }
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ branch: string }> },
) {
  try {
    const { branch } = await params;
    const decodedBranch = decodeURIComponent(branch);
    const { stepId, status } = await request.json();

    if (!stepId || !["pending", "in_progress", "done"].includes(status)) {
      return NextResponse.json(
        { error: "stepId and valid status are required" },
        { status: 400 },
      );
    }

    const planPath = path.join(PLAN_DIR, "active", decodedBranch, "plan.json");
    if (!fs.existsSync(planPath)) {
      return NextResponse.json(
        { error: "plan.json not found" },
        { status: 404 },
      );
    }

    const plan: PlanJson = JSON.parse(fs.readFileSync(planPath, "utf-8"));
    const step = plan.steps.find((s) => s.id === stepId);
    if (!step) {
      return NextResponse.json({ error: "Step not found" }, { status: 404 });
    }

    step.status = status;
    fs.writeFileSync(planPath, JSON.stringify(plan, null, 2), "utf-8");

    return NextResponse.json({ status: "updated", stepId, newStatus: status });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * DELETE /api/plan/:branch
 *
 * step을 삭제한다 (plan.json에서 제거 + md 파일 삭제).
 * Body: { stepId: string }
 */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ branch: string }> },
) {
  try {
    const { branch } = await params;
    const decodedBranch = decodeURIComponent(branch);
    const { stepId } = await request.json();

    if (!stepId) {
      return NextResponse.json(
        { error: "stepId is required" },
        { status: 400 },
      );
    }

    const dir = path.join(PLAN_DIR, "active", decodedBranch);
    const planPath = path.join(dir, "plan.json");
    if (!fs.existsSync(planPath)) {
      return NextResponse.json(
        { error: "plan.json not found" },
        { status: 404 },
      );
    }

    const plan: PlanJson = JSON.parse(fs.readFileSync(planPath, "utf-8"));
    const stepIdx = plan.steps.findIndex((s) => s.id === stepId);
    if (stepIdx === -1) {
      return NextResponse.json({ error: "Step not found" }, { status: 404 });
    }

    const step = plan.steps[stepIdx];
    const mdPath = path.join(dir, step.file);
    if (fs.existsSync(mdPath)) {
      fs.unlinkSync(mdPath);
    }

    plan.steps.splice(stepIdx, 1);
    fs.writeFileSync(planPath, JSON.stringify(plan, null, 2), "utf-8");

    return NextResponse.json({ status: "deleted", stepId });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
