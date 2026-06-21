import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, AuthError } from '@/lib/auth-middleware';
import { query, execute } from '@/lib/db';
import { z } from 'zod';

export interface VendorRow {
  'First Name':            string | null;
  'Last Name':             string | null;
  'Title':                 string | null;
  'Company Name':          string | null;
  'Email':                 string | null;
  'Corporate Phone':       string | null;
  'Industry':              string | null;
  'Website':               string | null;
  'Company Linkedin Url':  string | null;
  'Company Address':       string | null;
  'category':              string | null;
  'Personal LinkedIn':     string | null;
  'Industry/Service':      string | null;
  'Personal LinkedIn Url': string | null;
  'LAST_MODIFIED':         string | null;
}

interface CountRow { TOTAL: number }

// ─── GET /api/vendors ─────────────────────────────────────────────────────────

export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    await requireAuth(req);
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ message: err.message }, { status: err.statusCode });
    }
    return NextResponse.json({ message: 'Authentication error' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const page     = Math.max(1, parseInt(searchParams.get('page')     ?? '1',  10));
  const pageSize = Math.min(100, Math.max(1, parseInt(searchParams.get('pageSize') ?? '10', 10)));
  const offset   = (page - 1) * pageSize;

  // ── Filter params ─────────────────────────────────────────────────────────
  const category         = searchParams.get('category')         ?? '';
  const industry         = searchParams.get('industry')         ?? '';
  const lastModifiedFrom = searchParams.get('lastModifiedFrom') ?? '';  // YYYY-MM-DD
  const lastModifiedTo   = searchParams.get('lastModifiedTo')   ?? '';  // YYYY-MM-DD

  // Build WHERE clauses dynamically
  const conditions: string[]  = [];
  const filterParams: unknown[] = [];

  if (category) {
    conditions.push('"category" = ?');
    filterParams.push(category);
  }
  if (industry) {
    conditions.push('"Industry" = ?');
    filterParams.push(industry);
  }
  if (lastModifiedFrom) {
    conditions.push('"LAST_MODIFIED" >= ?');
    filterParams.push(`${lastModifiedFrom} 00:00:00`);
  }
  if (lastModifiedTo) {
    conditions.push('"LAST_MODIFIED" <= ?');
    filterParams.push(`${lastModifiedTo} 23:59:59`);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  try {
    const [countResult, rowsResult] = await Promise.all([
      query<CountRow>(
        `SELECT COUNT(*) AS "TOTAL" FROM "HATCH"."VENDOR" ${whereClause}`,
        filterParams
      ),
      query<VendorRow>(
        `SELECT
           "First Name", "Last Name", "Title", "Company Name",
           "Email", "Corporate Phone", "Industry", "Website",
           "Company Linkedin Url", "Company Address", "category",
           "Personal LinkedIn", "Industry/Service", "Personal LinkedIn Url",
           TO_VARCHAR("LAST_MODIFIED", 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS "LAST_MODIFIED"
         FROM "HATCH"."VENDOR"
         ${whereClause}
         LIMIT ? OFFSET ?`,
        [...filterParams, pageSize, offset]
      ),
    ]);

    const total = Number(countResult.rows[0]?.TOTAL ?? 0);

    return NextResponse.json({
      vendors:  rowsResult.rows,
      total,
      page,
      pageSize,
      pageCount: Math.ceil(total / pageSize),
    });
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    console.error('[vendors] HANA query error:', err);
    return NextResponse.json({ message: `Database error: ${detail}` }, { status: 500 });
  }
}

// ─── PATCH /api/vendors ───────────────────────────────────────────────────────
// Body: { email: string (original email used as key), fields: Partial<VendorRow> }

const PatchSchema = z.object({
  email:  z.string().email('Invalid email — used as row identifier'),
  fields: z.object({
    'First Name':            z.string().optional(),
    'Last Name':             z.string().optional(),
    'Title':                 z.string().optional(),
    'Company Name':          z.string().optional(),
    'Email':                 z.string().optional(),
    'Corporate Phone':       z.string().optional(),
    'Industry':              z.string().optional(),
    'Website':               z.string().optional(),
    'Company Linkedin Url':  z.string().optional(),
    'Company Address':       z.string().optional(),
    'category':              z.string().optional(),
    'Personal LinkedIn':     z.string().optional(),
    'Industry/Service':      z.string().optional(),
    'Personal LinkedIn Url': z.string().optional(),
  }),
});

export async function PATCH(req: NextRequest): Promise<NextResponse> {
  try {
    await requireAuth(req);
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ message: err.message }, { status: err.statusCode });
    }
    return NextResponse.json({ message: 'Authentication error' }, { status: 401 });
  }

  let body: z.infer<typeof PatchSchema>;
  try {
    body = PatchSchema.parse(await req.json());
  } catch (err) {
    const message = err instanceof z.ZodError
      ? err.errors.map((e) => `${e.path.join('.')}: ${e.message}`).join('; ')
      : 'Invalid request body';
    return NextResponse.json({ message }, { status: 400 });
  }

  const { email, fields } = body;
  const now = new Date().toISOString().replace('T', ' ').replace('Z', '');

  // Build SET clause dynamically from provided fields
  const updatableFields = Object.entries(fields).filter(([, v]) => v !== undefined);
  if (updatableFields.length === 0) {
    return NextResponse.json({ message: 'No fields to update' }, { status: 400 });
  }

  const setClauses = [
    ...updatableFields.map(([col]) => `"${col}" = ?`),
    `"LAST_MODIFIED" = ?`,
  ].join(', ');

  const params = [
    ...updatableFields.map(([, v]) => v === '' ? null : v),
    now,
    email, // WHERE "Email" = ?
  ];

  try {
    await execute(
      `UPDATE "HATCH"."VENDOR" SET ${setClauses} WHERE "Email" = ?`,
      params
    );
    return NextResponse.json({ ok: true, lastModified: now });
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    console.error('[vendors] HANA UPDATE error:', err);
    return NextResponse.json({ message: `Database error: ${detail}` }, { status: 500 });
  }
}
