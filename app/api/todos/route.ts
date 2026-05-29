import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { tagDB, todoDB } from '@/lib/db';
import { VALID_PRIORITIES, VALID_RECURRENCE_PATTERNS, VALID_REMINDER_MINUTES } from '@/lib/constants';
import { getSingaporeNow } from '@/lib/timezone';

function validateDueDate(dueDate: string): boolean {
  const now = getSingaporeNow();
  const due = new Date(dueDate);
  return due.getTime() > now.getTime() + 60_000;
}

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const todos = todoDB.getAll(session.userId);
  return NextResponse.json(
    { todos },
    {
      headers: {
        'Cache-Control': 'no-store, max-age=0',
      },
    },
  );
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const body = await request.json();
  const title = String(body.title ?? '').trim();
  const description = body.description ? String(body.description).slice(0, 2000) : null;
  const due_date = body.due_date ? String(body.due_date) : null;
  const priority = (body.priority ?? 'medium') as string;
  const is_recurring = Boolean(body.is_recurring);
  const recurrence_pattern = body.recurrence_pattern ? String(body.recurrence_pattern) : null;
  const reminder_minutes = body.reminder_minutes ?? null;
  const tagIds = Array.isArray(body.tagIds) ? body.tagIds.map(Number).filter(Number.isFinite) : [];

  if (!title) {
    return NextResponse.json({ error: 'Title is required' }, { status: 400 });
  }

  if (title.length > 500) {
    return NextResponse.json({ error: 'Title exceeds 500 characters' }, { status: 400 });
  }

  if (due_date && !validateDueDate(due_date)) {
    return NextResponse.json({ error: 'Due date must be at least 1 minute in the future' }, { status: 400 });
  }

  if (!VALID_PRIORITIES.includes(priority as never)) {
    return NextResponse.json({ error: 'Invalid priority' }, { status: 400 });
  }

  if (is_recurring) {
    if (!due_date) {
      return NextResponse.json({ error: 'Recurring todos require a due date' }, { status: 400 });
    }
    if (!recurrence_pattern || !VALID_RECURRENCE_PATTERNS.includes(recurrence_pattern as never)) {
      return NextResponse.json({ error: 'Invalid recurrence pattern' }, { status: 400 });
    }
  }

  if (reminder_minutes != null) {
    const minutes = Number(reminder_minutes);
    if (!VALID_REMINDER_MINUTES.includes(minutes)) {
      return NextResponse.json({ error: 'Invalid reminder_minutes value' }, { status: 400 });
    }
    if (!due_date) {
      return NextResponse.json({ error: 'Reminder requires a due date' }, { status: 400 });
    }
  }

  const todo = todoDB.create(session.userId, {
    title,
    description,
    due_date,
    priority: priority as 'high' | 'medium' | 'low',
    is_recurring,
    recurrence_pattern: recurrence_pattern as 'daily' | 'weekly' | 'monthly' | 'yearly' | null,
    reminder_minutes: reminder_minutes == null ? null : Number(reminder_minutes),
  });

  if (tagIds.length > 0) {
    tagDB.setForTodo(session.userId, todo.id, tagIds);
  }

  const saved = todoDB.getById(session.userId, todo.id);
  return NextResponse.json(saved, { status: 201 });
}
