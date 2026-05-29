import { NextRequest, NextResponse } from 'next/server';
import { SqliteError } from 'better-sqlite3';
import { getSession } from '@/lib/auth';
import { tagDB } from '@/lib/db';

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }
  return NextResponse.json({ tags: tagDB.getAll(session.userId) });
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const body = await request.json();
  const name = String(body.name ?? '').trim();
  const color = String(body.color ?? '#3B82F6');

  if (!name || name.length > 50) {
    return NextResponse.json({ error: 'Tag name is required and must be <= 50 chars' }, { status: 400 });
  }

  try {
    const tag = tagDB.create(session.userId, { name, color });
    return NextResponse.json(tag, { status: 201 });
  } catch (error) {
    if (error instanceof SqliteError && String(error.code).includes('CONSTRAINT')) {
      return NextResponse.json({ error: 'Tag name already exists' }, { status: 409 });
    }
    throw error;
  }
}
