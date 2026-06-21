import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, AuthError } from '@/lib/auth-middleware';
import { query } from '@/lib/db';

interface DistinctRow { VAL: string | null }

export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    await requireAuth(req);
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ message: err.message }, { status: err.statusCode });
    }
    return NextResponse.json({ message: 'Authentication error' }, { status: 401 });
  }

  try {
    const [categoryResult, industryResult] = await Promise.all([
      query<DistinctRow>(
        `SELECT DISTINCT "category" AS "VAL"
           FROM "HATCH"."VENDOR"
          WHERE "category" IS NOT NULL AND "category" != ''
          ORDER BY "VAL"`,
        []
      ),
      query<DistinctRow>(
        `SELECT DISTINCT "Industry" AS "VAL"
           FROM "HATCH"."VENDOR"
          WHERE "Industry" IS NOT NULL AND "Industry" != ''
          ORDER BY "VAL"`,
        []
      ),
    ]);

    return NextResponse.json({
      categories: categoryResult.rows.map((r) => r.VAL!),
      industries:  industryResult.rows.map((r) => r.VAL!),
    });
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ message: `Database error: ${detail}` }, { status: 500 });
  }
}
