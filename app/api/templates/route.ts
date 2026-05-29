import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { templateDB } from '@/lib/db';

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  return NextResponse.json({ templates: templateDB.getAll(session.userId) });
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const body = await request.json();
  const name = String(body.name ?? '').trim();
  const title = String(body.title ?? '').trim();

  if (!name || !title) {
    return NextResponse.json({ error: 'Template name and title are required' }, { status: 400 });
  }

  const template = templateDB.create(session.userId, {
    name,
    description: body.description,
    category: body.category,
    title,
    notes: body.notes,
    priority: body.priority ?? 'medium',
    is_recurring: Boolean(body.is_recurring),
    recurrence_pattern: body.recurrence_pattern ?? null,
    reminder_minutes: body.reminder_minutes ?? null,
    due_date_offset_days: body.due_date_offset_days ?? null,
    subtasks: Array.isArray(body.subtasks) ? body.subtasks : [],
  });

  return NextResponse.json(template, { status: 201 });
}
