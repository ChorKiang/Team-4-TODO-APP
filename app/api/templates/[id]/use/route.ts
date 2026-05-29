import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { subtaskDB, templateDB, todoDB } from '@/lib/db';
import { getSingaporeNow } from '@/lib/timezone';

export async function POST(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const { id } = await params;
  const template = templateDB.getById(session.userId, Number(id));
  if (!template) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  let dueDate: string | undefined;
  if (template.due_date_offset_days != null) {
    const date = getSingaporeNow();
    date.setDate(date.getDate() + template.due_date_offset_days);
    dueDate = date.toISOString();
  }

  const todo = todoDB.create(session.userId, {
    title: template.title,
    description: template.notes,
    priority: template.priority,
    due_date: dueDate,
    is_recurring: template.is_recurring,
    recurrence_pattern: template.recurrence_pattern,
    reminder_minutes: template.reminder_minutes,
  });

  const subtasks = JSON.parse(template.subtasks_json ?? '[]') as Array<{ title: string }>;
  for (const subtask of subtasks) {
    if (subtask.title?.trim()) {
      subtaskDB.create(todo.id, session.userId, { title: subtask.title.trim() });
    }
  }

  return NextResponse.json(todoDB.getById(session.userId, todo.id), { status: 201 });
}
