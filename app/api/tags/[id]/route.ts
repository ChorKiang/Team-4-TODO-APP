import { NextRequest, NextResponse } from 'next/server';
import { SqliteError } from 'better-sqlite3';
import { getSession } from '@/lib/auth';
import { tagDB } from '@/lib/db';

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const { id } = await params;
  const body = await request.json();

  try {
    const tag = tagDB.update(session.userId, Number(id), {
      name: body.name,
      color: body.color,
    });

    if (!tag) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    return NextResponse.json(tag);
  } catch (error) {
    if (error instanceof SqliteError && String(error.code).includes('CONSTRAINT')) {
      return NextResponse.json({ error: 'Tag name already exists' }, { status: 409 });
    }
    throw error;
  }
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const { id } = await params;
  const deleted = tagDB.delete(session.userId, Number(id));
  if (!deleted) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  return NextResponse.json({ deleted: true });
}
