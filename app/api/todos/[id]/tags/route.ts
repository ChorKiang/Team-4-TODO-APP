import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { tagDB, todoDB } from '@/lib/db';

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const { id } = await params;
  const todoId = Number(id);
  if (!todoDB.getById(session.userId, todoId)) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const body = await request.json();
  const tagIds = Array.isArray(body.tagIds) ? body.tagIds.map(Number).filter(Number.isFinite) : [];
  tagDB.setForTodo(session.userId, todoId, tagIds);

  return NextResponse.json({ tags: tagDB.getForTodo(session.userId, todoId) });
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const { id } = await params;
  const todoId = Number(id);
  if (!todoDB.getById(session.userId, todoId)) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const body = await request.json();
  const tagId = Number(body.tagId);
  tagDB.removeFromTodo(session.userId, todoId, tagId);

  return NextResponse.json({ tags: tagDB.getForTodo(session.userId, todoId) });
}
