import { NextResponse } from 'next/server';

import { db } from '@/lib/db';
import { clients } from '@/lib/db/schema';

export async function GET() {
  try {
    const result = await db
      .select({
        id: clients.id,
        name: clients.name,
      })
      .from(clients)
      .limit(1);

    return NextResponse.json({
      ok: true,
      resultCount: result.length,
      sample: result[0] ?? null,
    });
  } catch (error) {
    console.error('test-drizzle', error);

    return NextResponse.json(
      { ok: false, error: 'Failed to query database via Drizzle' },
      { status: 500 },
    );
  }
}

