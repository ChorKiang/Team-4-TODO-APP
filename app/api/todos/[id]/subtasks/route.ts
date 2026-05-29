import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { subtaskDB, todoDB } from '@/lib/db';

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const { id } = await params;
  const todoId = Number(id);
  const todo = todoDB.getById(session.userId, todoId);
  if (!todo) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const body = await request.json();
  const title = String(body.title ?? '').trim();
  if (!title || title.length > 500) {
    return NextResponse.json({ error: 'Subtask title is required and must be <= 500 chars' }, { status: 400 });
  }

  const subtask = subtaskDB.create(todoId, session.userId, { title });
  return NextResponse.json(subtask, { status: 201 });
}
