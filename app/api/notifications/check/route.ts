import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { notificationDB } from '@/lib/db';
import { getSingaporeNow } from '@/lib/timezone';

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const now = getSingaporeNow().toISOString();
  const todos = notificationDB.getTodosNeedingNotification(session.userId, now);

  for (const todo of todos) {
    notificationDB.markNotificationSent(todo.id, now);
  }

  return NextResponse.json({ todos });
}
