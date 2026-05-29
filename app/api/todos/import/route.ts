import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { subtaskDB, tagDB, todoDB } from '@/lib/db';

function validateExportFormat(data: unknown): string | null {
  if (!data || typeof data !== 'object') return 'File is not valid JSON';
  const d = data as Record<string, unknown>;
  if (d.version !== '1.0') return `Unsupported version: ${String(d.version)}`;
  if (!Array.isArray(d.todos)) return 'Missing todos array';
  if (!Array.isArray(d.tags)) return 'Missing tags array';
  return null;
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const body = (await request.json()) as {
    tags: Array<{ id: number; name: string; color?: string }>;
    todos: Array<{
      title: string;
      description?: string | null;
      due_date?: string | null;
      completed?: boolean;
      priority?: 'high' | 'medium' | 'low';
      is_recurring?: boolean;
      recurrence_pattern?: 'daily' | 'weekly' | 'monthly' | 'yearly' | null;
      reminder_minutes?: number | null;
      subtasks?: Array<{ title: string; completed?: boolean }>;
      tag_ids?: number[];
    }>;
    version: string;
  };

  const validationError = validateExportFormat(body);
  if (validationError) {
    return NextResponse.json({ error: validationError }, { status: 400 });
  }

  const tagIdMap: Record<number, number> = {};
  for (const exportedTag of body.tags ?? []) {
    if (!exportedTag.name?.trim()) continue;
    const existing = tagDB.getByName(session.userId, exportedTag.name.trim());
    if (existing) {
      tagIdMap[exportedTag.id] = existing.id;
    } else {
      const created = tagDB.create(session.userId, {
        name: exportedTag.name.trim(),
        color: exportedTag.color ?? '#3B82F6',
      });
      tagIdMap[exportedTag.id] = created.id;
    }
  }

  let importedTodoCount = 0;
  for (const exportedTodo of body.todos ?? []) {
    if (!exportedTodo.title?.trim()) continue;

    const todo = todoDB.create(session.userId, {
      title: exportedTodo.title.trim(),
      description: exportedTodo.description ?? null,
      due_date: exportedTodo.due_date ?? null,
      priority: exportedTodo.priority ?? 'medium',
      is_recurring: exportedTodo.is_recurring ?? false,
      recurrence_pattern: exportedTodo.recurrence_pattern ?? null,
      reminder_minutes: exportedTodo.reminder_minutes ?? null,
    });

    if (exportedTodo.completed) {
      todoDB.update(session.userId, todo.id, { completed: true });
    }

    for (const subtask of exportedTodo.subtasks ?? []) {
      if (!subtask.title?.trim()) continue;
      const createdSubtask = subtaskDB.create(todo.id, session.userId, { title: subtask.title.trim() });
      if (subtask.completed) {
        subtaskDB.update(createdSubtask.id, todo.id, session.userId, { completed: true });
      }
    }

    for (const oldTagId of exportedTodo.tag_ids ?? []) {
      const newTagId = tagIdMap[oldTagId];
      if (newTagId) {
        tagDB.addToTodo(session.userId, todo.id, newTagId);
      }
    }

    importedTodoCount += 1;
  }

  return NextResponse.json({
    imported: {
      todos: importedTodoCount,
      tags: Object.keys(tagIdMap).length,
    },
  });
}
