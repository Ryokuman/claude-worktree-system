import { NextResponse } from "next/server";
import {
  readMainRepoEnv,
  readEnvTemplate,
  writeEnvTemplate,
  type EnvTemplate,
} from "@/lib/env-generator";

/**
 * GET /api/env/template
 *
 * 메인 레포의 .env 파라미터 목록 + 현재 템플릿 설정을 반환한다.
 */
export async function GET() {
  const mainEnv = readMainRepoEnv();
  const template = readEnvTemplate();

  return NextResponse.json({
    mainEnv: mainEnv ? { entries: mainEnv.entries, source: mainEnv.source } : null,
    template,
  });
}

/**
 * PUT /api/env/template
 *
 * env 템플릿(오버라이드 설정)을 저장한다.
 *
 * Body: EnvTemplate
 */
export async function PUT(request: Request) {
  try {
    const body: EnvTemplate = await request.json();
    writeEnvTemplate(body);
    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
