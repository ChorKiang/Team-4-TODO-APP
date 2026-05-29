import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { calculateNextDueDate } from '@/lib/timezone';
import { tagDB, todoDB } from '@/lib/db';
import { VALID_PRIORITIES, VALID_RECURRENCE_PATTERNS, VALID_REMINDER_MINUTES } from '@/lib/constants';

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const { id } = await params;
  const todo = todoDB.getById(session.userId, Number(id));
  if (!todo) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  return NextResponse.json(todo);
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const { id } = await params;
  const todoId = Number(id);
  const existing = todoDB.getById(session.userId, todoId);
  if (!existing) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const body = await request.json();

  if (body.title !== undefined) {
    const title = String(body.title).trim();
    if (!title || title.length > 500) {
      return NextResponse.json({ error: 'Invalid title' }, { status: 400 });
    }
  }

  if (body.priority && !VALID_PRIORITIES.includes(body.priority)) {
    return NextResponse.json({ error: 'Invalid priority' }, { status: 400 });
  }

  const due_date = body.due_date !== undefined ? body.due_date : existing.due_date;
  const is_recurring = body.is_recurring !== undefined ? Boolean(body.is_recurring) : existing.is_recurring;
  const recurrence_pattern =
    body.recurrence_pattern !== undefined ? body.recurrence_pattern : existing.recurrence_pattern;

  if (is_recurring) {
    if (!due_date) {
      return NextResponse.json({ error: 'Recurring todos require a due date' }, { status: 400 });
    }
    if (!recurrence_pattern || !VALID_RECURRENCE_PATTERNS.includes(recurrence_pattern)) {
      return NextResponse.json({ error: 'Invalid recurrence pattern' }, { status: 400 });
    }
  }

  if (body.reminder_minutes !== undefined && body.reminder_minutes !== null) {
    const reminder = Number(body.reminder_minutes);
    if (!VALID_REMINDER_MINUTES.includes(reminder)) {
      return NextResponse.json({ error: 'Invalid reminder_minutes value' }, { status: 400 });
    }
    if (!due_date) {
      return NextResponse.json({ error: 'Reminder requires a due date' }, { status: 400 });
    }
  }

  const updated = todoDB.update(session.userId, todoId, {
    title: body.title,
    description: body.description,
    completed: body.completed,
    due_date: body.due_date,
    priority: body.priority,
    is_recurring: body.is_recurring,
    recurrence_pattern: body.recurrence_pattern,
    reminder_minutes: body.due_date === null ? null : body.reminder_minutes,
  });

  if (!updated) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  if (Array.isArray(body.tagIds)) {
    tagDB.setForTodo(session.userId, todoId, body.tagIds.map(Number).filter(Number.isFinite));
  }

  if (
    body.completed === true &&
    existing.is_recurring &&
    existing.recurrence_pattern &&
    existing.due_date
  ) {
    const nextDueDate = calculateNextDueDate(existing.due_date, existing.recurrence_pattern);

    const nextTodo = todoDB.create(session.userId, {
      title: existing.title,
      description: existing.description,
      priority: existing.priority,
      due_date: nextDueDate,
      is_recurring: true,
      recurrence_pattern: existing.recurrence_pattern,
      reminder_minutes: existing.reminder_minutes,
    });

    for (const tag of existing.tags) {
      tagDB.addToTodo(session.userId, nextTodo.id, tag.id);
    }
  }

  return NextResponse.json(todoDB.getById(session.userId, todoId));
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const { id } = await params;
  const deleted = todoDB.delete(session.userId, Number(id));
  if (!deleted) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  return NextResponse.json({ deleted: true });
}
