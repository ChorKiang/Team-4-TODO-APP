import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { tagDB, todoDB } from '@/lib/db';
import { getSingaporeNow } from '@/lib/timezone';

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const todos = todoDB.getAll(session.userId);
  const tags = tagDB.getAll(session.userId);

  const exportData = {
    version: '1.0',
    exported_at: getSingaporeNow().toISOString(),
    tags: tags.map((tag) => ({
      id: tag.id,
      name: tag.name,
      color: tag.color,
    })),
    todos: todos.map((todo) => ({
      id: todo.id,
      title: todo.title,
      description: todo.description,
      completed: todo.completed,
      due_date: todo.due_date,
      priority: todo.priority,
      is_recurring: todo.is_recurring,
      recurrence_pattern: todo.recurrence_pattern,
      reminder_minutes: todo.reminder_minutes,
      created_at: todo.created_at,
      subtasks: todo.subtasks.map((s) => ({
        title: s.title,
        completed: s.completed,
        position: s.position,
      })),
      tag_ids: todo.tags.map((tag) => tag.id),
    })),
  };

  return NextResponse.json(exportData);
}
