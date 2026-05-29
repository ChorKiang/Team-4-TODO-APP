import Database from 'better-sqlite3';
import path from 'path';
import { getSingaporeNow } from '@/lib/timezone';

const dbBasePath = process.env.RAILWAY_VOLUME_MOUNT_PATH || process.cwd();
const dbPath = path.join(dbBasePath, 'todos.db');
const db = new Database(dbPath);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

export type Priority = 'high' | 'medium' | 'low';
export type RecurrencePattern = 'daily' | 'weekly' | 'monthly' | 'yearly';

export interface User {
  id: number;
  username: string;
  created_at: string;
}

export interface Authenticator {
  id: number;
  user_id: number;
  credential_id: string;
  credential_public_key: string;
  counter: number;
  transports: string | null;
  created_at: string;
}

export interface Subtask {
  id: number;
  todo_id: number;
  title: string;
  completed: boolean;
  position: number;
  created_at: string;
}

export interface Tag {
  id: number;
  user_id: number;
  name: string;
  color: string;
  created_at: string;
}

export interface Todo {
  id: number;
  user_id: number;
  title: string;
  description: string | null;
  completed: boolean;
  due_date: string | null;
  priority: Priority;
  is_recurring: boolean;
  recurrence_pattern: RecurrencePattern | null;
  reminder_minutes: number | null;
  last_notification_sent: string | null;
  created_at: string;
  updated_at: string;
  subtasks: Subtask[];
  tags: Tag[];
}

export interface CreateTodoInput {
  title: string;
  description?: string | null;
  completed?: boolean;
  due_date?: string | null;
  priority?: Priority;
  is_recurring?: boolean;
  recurrence_pattern?: RecurrencePattern | null;
  reminder_minutes?: number | null;
}

export interface UpdateTodoInput {
  title?: string;
  description?: string | null;
  completed?: boolean;
  due_date?: string | null;
  priority?: Priority;
  is_recurring?: boolean;
  recurrence_pattern?: RecurrencePattern | null;
  reminder_minutes?: number | null;
  last_notification_sent?: string | null;
}

export interface Template {
  id: number;
  user_id: number;
  name: string;
  description: string | null;
  category: string | null;
  title: string;
  notes: string | null;
  priority: Priority;
  is_recurring: boolean;
  recurrence_pattern: RecurrencePattern | null;
  reminder_minutes: number | null;
  due_date_offset_days: number | null;
  subtasks_json: string | null;
  created_at: string;
  updated_at: string;
}

export interface Holiday {
  id: number;
  date: string;
  name: string;
}

db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  username   TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS authenticators (
  id                    INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id               INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  credential_id         TEXT NOT NULL UNIQUE,
  credential_public_key TEXT NOT NULL,
  counter               INTEGER NOT NULL DEFAULT 0,
  transports            TEXT,
  created_at            TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS todos (
  id                      INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id                 INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title                   TEXT NOT NULL,
  description             TEXT,
  completed               INTEGER NOT NULL DEFAULT 0,
  due_date                TEXT,
  created_at              TEXT NOT NULL,
  updated_at              TEXT NOT NULL,
  priority                TEXT NOT NULL DEFAULT 'medium',
  is_recurring            INTEGER NOT NULL DEFAULT 0,
  recurrence_pattern      TEXT,
  reminder_minutes        INTEGER,
  last_notification_sent  TEXT
);

CREATE TABLE IF NOT EXISTS subtasks (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  todo_id     INTEGER NOT NULL REFERENCES todos(id) ON DELETE CASCADE,
  title       TEXT NOT NULL,
  completed   INTEGER NOT NULL DEFAULT 0,
  position    INTEGER NOT NULL DEFAULT 0,
  created_at  TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS tags (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name       TEXT NOT NULL,
  color      TEXT NOT NULL DEFAULT '#3B82F6',
  created_at TEXT NOT NULL,
  UNIQUE(user_id, name)
);

CREATE TABLE IF NOT EXISTS todo_tags (
  todo_id INTEGER NOT NULL REFERENCES todos(id) ON DELETE CASCADE,
  tag_id  INTEGER NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  PRIMARY KEY (todo_id, tag_id)
);

CREATE TABLE IF NOT EXISTS templates (
  id                 INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id            INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name               TEXT NOT NULL,
  description        TEXT,
  category           TEXT,
  title              TEXT NOT NULL,
  notes              TEXT,
  priority           TEXT NOT NULL DEFAULT 'medium',
  is_recurring       INTEGER NOT NULL DEFAULT 0,
  recurrence_pattern TEXT,
  reminder_minutes   INTEGER,
  due_date_offset_days INTEGER,
  subtasks_json      TEXT,
  created_at         TEXT NOT NULL,
  updated_at         TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS holidays (
  id   INTEGER PRIMARY KEY AUTOINCREMENT,
  date TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_authenticators_user_id ON authenticators(user_id);
CREATE INDEX IF NOT EXISTS idx_authenticators_credential_id ON authenticators(credential_id);
CREATE INDEX IF NOT EXISTS idx_todos_user_id ON todos(user_id);
CREATE INDEX IF NOT EXISTS idx_todos_due_date ON todos(due_date);
CREATE INDEX IF NOT EXISTS idx_subtasks_todo_id ON subtasks(todo_id);
CREATE INDEX IF NOT EXISTS idx_tags_user_id ON tags(user_id);
CREATE INDEX IF NOT EXISTS idx_todo_tags_todo_id ON todo_tags(todo_id);
CREATE INDEX IF NOT EXISTS idx_todo_tags_tag_id ON todo_tags(tag_id);
CREATE INDEX IF NOT EXISTS idx_templates_user_id ON templates(user_id);
`);

const todoColumns = `
  id, user_id, title, description, completed, due_date, created_at, updated_at,
  priority, is_recurring, recurrence_pattern, reminder_minutes, last_notification_sent
`;

function mapSubtask(row: Record<string, unknown>): Subtask {
  return {
    id: Number(row.id),
    todo_id: Number(row.todo_id),
    title: String(row.title),
    completed: Number(row.completed) === 1,
    position: Number(row.position),
    created_at: String(row.created_at),
  };
}

function mapTag(row: Record<string, unknown>): Tag {
  return {
    id: Number(row.id),
    user_id: Number(row.user_id),
    name: String(row.name),
    color: String(row.color),
    created_at: String(row.created_at),
  };
}

function mapTodoBase(row: Record<string, unknown>): Omit<Todo, 'subtasks' | 'tags'> {
  return {
    id: Number(row.id),
    user_id: Number(row.user_id),
    title: String(row.title),
    description: (row.description as string | null) ?? null,
    completed: Number(row.completed) === 1,
    due_date: (row.due_date as string | null) ?? null,
    priority: ((row.priority as Priority) ?? 'medium'),
    is_recurring: Number(row.is_recurring) === 1,
    recurrence_pattern: (row.recurrence_pattern as RecurrencePattern | null) ?? null,
    reminder_minutes: (row.reminder_minutes as number | null) ?? null,
    last_notification_sent: (row.last_notification_sent as string | null) ?? null,
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
  };
}

function assertTodoOwnership(todoId: number, userId: number): boolean {
  const row = db.prepare('SELECT 1 FROM todos WHERE id = ? AND user_id = ?').get(todoId, userId);
  return Boolean(row);
}

export const userDB = {
  create(username: string): User {
    const now = getSingaporeNow().toISOString();
    const stmt = db.prepare('INSERT INTO users (username, created_at) VALUES (?, ?)');
    const result = stmt.run(username.trim(), now);
    return this.getById(Number(result.lastInsertRowid)) as User;
  },
  getByUsername(username: string): User | null {
    const row = db.prepare('SELECT * FROM users WHERE username = ?').get(username.trim()) as User | undefined;
    return row ?? null;
  },
  getById(id: number): User | null {
    const row = db.prepare('SELECT * FROM users WHERE id = ?').get(id) as User | undefined;
    return row ?? null;
  },
};

export const authenticatorDB = {
  create(
    userId: number,
    data: {
      credential_id: string;
      credential_public_key: string;
      counter: number;
      transports?: string;
    },
  ): Authenticator {
    const now = getSingaporeNow().toISOString();
    const result = db
      .prepare(
        `INSERT INTO authenticators (user_id, credential_id, credential_public_key, counter, transports, created_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
      )
      .run(userId, data.credential_id, data.credential_public_key, data.counter ?? 0, data.transports ?? null, now);

    return db.prepare('SELECT * FROM authenticators WHERE id = ?').get(result.lastInsertRowid) as Authenticator;
  },
  getByCredentialId(credentialId: string): Authenticator | null {
    const row = db.prepare('SELECT * FROM authenticators WHERE credential_id = ?').get(credentialId) as Authenticator | undefined;
    return row ?? null;
  },
  getByUserId(userId: number): Authenticator[] {
    return db.prepare('SELECT * FROM authenticators WHERE user_id = ? ORDER BY id ASC').all(userId) as Authenticator[];
  },
  updateCounter(id: number, counter: number): void {
    db.prepare('UPDATE authenticators SET counter = ? WHERE id = ?').run(counter ?? 0, id);
  },
};

export const subtaskDB = {
  create(todoId: number, userId: number, input: { title: string }): Subtask {
    if (!assertTodoOwnership(todoId, userId)) {
      throw new Error('Todo not found');
    }
    const now = getSingaporeNow().toISOString();
    const maxPositionRow = db.prepare('SELECT COALESCE(MAX(position), -1) as maxPos FROM subtasks WHERE todo_id = ?').get(todoId) as { maxPos: number };
    const nextPosition = Number(maxPositionRow.maxPos) + 1;
    const result = db
      .prepare('INSERT INTO subtasks (todo_id, title, completed, position, created_at) VALUES (?, ?, 0, ?, ?)')
      .run(todoId, input.title.trim(), nextPosition, now);

    const row = db.prepare('SELECT * FROM subtasks WHERE id = ?').get(result.lastInsertRowid) as Record<string, unknown>;
    return mapSubtask(row);
  },
  getForTodo(todoId: number, userId: number): Subtask[] {
    if (!assertTodoOwnership(todoId, userId)) {
      return [];
    }
    const rows = db.prepare('SELECT * FROM subtasks WHERE todo_id = ? ORDER BY position ASC, id ASC').all(todoId) as Record<string, unknown>[];
    return rows.map(mapSubtask);
  },
  update(id: number, _todoId: number, userId: number, input: { title?: string; completed?: boolean }): Subtask | null {
    const row = db
      .prepare(
        `SELECT s.*
         FROM subtasks s
         INNER JOIN todos t ON t.id = s.todo_id
         WHERE s.id = ? AND t.user_id = ?`,
      )
      .get(id, userId) as Record<string, unknown> | undefined;

    if (!row) return null;
    const updates: string[] = [];
    const values: unknown[] = [];

    if (typeof input.title === 'string') {
      updates.push('title = ?');
      values.push(input.title.trim());
    }

    if (typeof input.completed === 'boolean') {
      updates.push('completed = ?');
      values.push(input.completed ? 1 : 0);
    }

    if (updates.length === 0) {
      return mapSubtask(row);
    }

    values.push(id);
    db.prepare(`UPDATE subtasks SET ${updates.join(', ')} WHERE id = ?`).run(...values);

    const updated = db.prepare('SELECT * FROM subtasks WHERE id = ?').get(id) as Record<string, unknown>;
    return mapSubtask(updated);
  },
  delete(id: number, _todoId: number, userId: number): boolean {
    const row = db
      .prepare(
        `SELECT s.id
         FROM subtasks s
         INNER JOIN todos t ON t.id = s.todo_id
         WHERE s.id = ? AND t.user_id = ?`,
      )
      .get(id, userId);

    if (!row) return false;
    const result = db.prepare('DELETE FROM subtasks WHERE id = ?').run(id);
    return result.changes > 0;
  },
};

export const tagDB = {
  create(userId: number, input: { name: string; color?: string }): Tag {
    const now = getSingaporeNow().toISOString();
    const result = db
      .prepare('INSERT INTO tags (user_id, name, color, created_at) VALUES (?, ?, ?, ?)')
      .run(userId, input.name.trim(), input.color ?? '#3B82F6', now);
    return this.getById(userId, Number(result.lastInsertRowid)) as Tag;
  },
  getAll(userId: number): Tag[] {
    const rows = db.prepare('SELECT * FROM tags WHERE user_id = ? ORDER BY name ASC').all(userId) as Record<string, unknown>[];
    return rows.map(mapTag);
  },
  getById(userId: number, id: number): Tag | null {
    const row = db.prepare('SELECT * FROM tags WHERE user_id = ? AND id = ?').get(userId, id) as Record<string, unknown> | undefined;
    return row ? mapTag(row) : null;
  },
  getByName(userId: number, name: string): Tag | null {
    const row = db.prepare('SELECT * FROM tags WHERE user_id = ? AND name = ?').get(userId, name.trim()) as Record<string, unknown> | undefined;
    return row ? mapTag(row) : null;
  },
  update(userId: number, id: number, input: { name?: string; color?: string }): Tag | null {
    const existing = this.getById(userId, id);
    if (!existing) return null;
    db.prepare('UPDATE tags SET name = ?, color = ? WHERE id = ? AND user_id = ?').run(
      input.name?.trim() ?? existing.name,
      input.color ?? existing.color,
      id,
      userId,
    );
    return this.getById(userId, id);
  },
  delete(userId: number, id: number): boolean {
    const result = db.prepare('DELETE FROM tags WHERE user_id = ? AND id = ?').run(userId, id);
    return result.changes > 0;
  },
  getForTodo(userId: number, todoId: number): Tag[] {
    if (!assertTodoOwnership(todoId, userId)) return [];
    const rows = db
      .prepare(
        `SELECT t.*
         FROM tags t
         INNER JOIN todo_tags tt ON tt.tag_id = t.id
         WHERE tt.todo_id = ? AND t.user_id = ?
         ORDER BY t.name ASC`,
      )
      .all(todoId, userId) as Record<string, unknown>[];
    return rows.map(mapTag);
  },
  addToTodo(userId: number, todoId: number, tagId: number): void {
    if (!assertTodoOwnership(todoId, userId)) return;
    const tag = this.getById(userId, tagId);
    if (!tag) return;
    db.prepare('INSERT OR IGNORE INTO todo_tags (todo_id, tag_id) VALUES (?, ?)').run(todoId, tagId);
  },
  removeFromTodo(userId: number, todoId: number, tagId: number): void {
    if (!assertTodoOwnership(todoId, userId)) return;
    db.prepare(
      `DELETE FROM todo_tags
       WHERE todo_id = ?
         AND tag_id = ?
         AND tag_id IN (SELECT id FROM tags WHERE user_id = ?)`,
    ).run(todoId, tagId, userId);
  },
  setForTodo(userId: number, todoId: number, tagIds: number[]): void {
    if (!assertTodoOwnership(todoId, userId)) return;
    db.prepare('DELETE FROM todo_tags WHERE todo_id = ?').run(todoId);
    for (const tagId of tagIds) {
      if (this.getById(userId, tagId)) {
        db.prepare('INSERT OR IGNORE INTO todo_tags (todo_id, tag_id) VALUES (?, ?)').run(todoId, tagId);
      }
    }
  },
};

export const todoDB = {
  create(userId: number, input: CreateTodoInput): Todo {
    const now = getSingaporeNow().toISOString();
    const result = db
      .prepare(
        `INSERT INTO todos (
          user_id, title, description, completed, due_date, created_at, updated_at,
          priority, is_recurring, recurrence_pattern, reminder_minutes, last_notification_sent
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL)`,
      )
      .run(
        userId,
        input.title.trim(),
        input.description ?? null,
        input.completed ? 1 : 0,
        input.due_date ?? null,
        now,
        now,
        input.priority ?? 'medium',
        input.is_recurring ? 1 : 0,
        input.recurrence_pattern ?? null,
        input.reminder_minutes ?? null,
      );

    return this.getById(userId, Number(result.lastInsertRowid)) as Todo;
  },
  getAll(userId: number): Todo[] {
    const rows = db.prepare(`SELECT ${todoColumns} FROM todos WHERE user_id = ? ORDER BY created_at ASC`).all(userId) as Record<string, unknown>[];
    return rows.map((row) => {
      const base = mapTodoBase(row);
      return {
        ...base,
        subtasks: subtaskDB.getForTodo(base.id, userId),
        tags: tagDB.getForTodo(userId, base.id),
      };
    });
  },
  getById(userId: number, id: number): Todo | null {
    const row = db.prepare(`SELECT ${todoColumns} FROM todos WHERE user_id = ? AND id = ?`).get(userId, id) as Record<string, unknown> | undefined;
    if (!row) return null;
    const base = mapTodoBase(row);
    return {
      ...base,
      subtasks: subtaskDB.getForTodo(base.id, userId),
      tags: tagDB.getForTodo(userId, base.id),
    };
  },
  update(userId: number, id: number, input: UpdateTodoInput): Todo | null {
    const existing = this.getById(userId, id);
    if (!existing) return null;

    const merged = {
      title: input.title ?? existing.title,
      description: input.description !== undefined ? input.description : existing.description,
      completed: input.completed !== undefined ? input.completed : existing.completed,
      due_date: input.due_date !== undefined ? input.due_date : existing.due_date,
      priority: input.priority ?? existing.priority,
      is_recurring: input.is_recurring !== undefined ? input.is_recurring : existing.is_recurring,
      recurrence_pattern:
        input.recurrence_pattern !== undefined ? input.recurrence_pattern : existing.recurrence_pattern,
      reminder_minutes: input.reminder_minutes !== undefined ? input.reminder_minutes : existing.reminder_minutes,
      last_notification_sent:
        input.last_notification_sent !== undefined ? input.last_notification_sent : existing.last_notification_sent,
    };

    const now = getSingaporeNow().toISOString();
    db
      .prepare(
        `UPDATE todos
         SET title = ?, description = ?, completed = ?, due_date = ?, updated_at = ?,
             priority = ?, is_recurring = ?, recurrence_pattern = ?, reminder_minutes = ?, last_notification_sent = ?
         WHERE user_id = ? AND id = ?`,
      )
      .run(
        merged.title.trim(),
        merged.description ?? null,
        merged.completed ? 1 : 0,
        merged.due_date ?? null,
        now,
        merged.priority,
        merged.is_recurring ? 1 : 0,
        merged.recurrence_pattern ?? null,
        merged.reminder_minutes ?? null,
        merged.last_notification_sent ?? null,
        userId,
        id,
      );

    return this.getById(userId, id);
  },
  delete(userId: number, id: number): boolean {
    const result = db.prepare('DELETE FROM todos WHERE user_id = ? AND id = ?').run(userId, id);
    return result.changes > 0;
  },
};

export const notificationDB = {
  getTodosNeedingNotification(userId: number, nowIso: string): Todo[] {
    const rows = db
      .prepare(
        `SELECT ${todoColumns}
         FROM todos
         WHERE user_id = ?
           AND completed = 0
           AND reminder_minutes IS NOT NULL
           AND due_date IS NOT NULL
           AND datetime(due_date, '-' || reminder_minutes || ' minutes') <= datetime(?)
           AND (last_notification_sent IS NULL
                OR datetime(last_notification_sent, '+' || reminder_minutes || ' minutes') <= datetime(?))`,
      )
      .all(userId, nowIso, nowIso) as Record<string, unknown>[];

    return rows.map((row) => {
      const base = mapTodoBase(row);
      return { ...base, subtasks: [], tags: [] };
    });
  },
  markNotificationSent(todoId: number, nowIso: string): void {
    db.prepare('UPDATE todos SET last_notification_sent = ?, updated_at = ? WHERE id = ?').run(nowIso, nowIso, todoId);
  },
};

export const templateDB = {
  create(
    userId: number,
    input: {
      name: string;
      description?: string;
      category?: string;
      title: string;
      notes?: string;
      priority: Priority;
      is_recurring: boolean;
      recurrence_pattern?: RecurrencePattern | null;
      reminder_minutes?: number | null;
      due_date_offset_days?: number | null;
      subtasks: { title: string; position: number }[];
    },
  ): Template {
    const now = getSingaporeNow().toISOString();
    const result = db
      .prepare(
        `INSERT INTO templates (
          user_id, name, description, category, title, notes, priority,
          is_recurring, recurrence_pattern, reminder_minutes, due_date_offset_days,
          subtasks_json, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        userId,
        input.name.trim(),
        input.description ?? null,
        input.category ?? null,
        input.title.trim(),
        input.notes ?? null,
        input.priority,
        input.is_recurring ? 1 : 0,
        input.recurrence_pattern ?? null,
        input.reminder_minutes ?? null,
        input.due_date_offset_days ?? null,
        JSON.stringify(input.subtasks ?? []),
        now,
        now,
      );

    return this.getById(userId, Number(result.lastInsertRowid)) as Template;
  },
  getAll(userId: number): Template[] {
    const rows = db.prepare('SELECT * FROM templates WHERE user_id = ? ORDER BY created_at DESC').all(userId) as Template[];
    return rows.map((t) => ({ ...t, is_recurring: Number(t.is_recurring) === 1 }));
  },
  getById(userId: number, id: number): Template | null {
    const row = db.prepare('SELECT * FROM templates WHERE user_id = ? AND id = ?').get(userId, id) as Template | undefined;
    return row ? { ...row, is_recurring: Number(row.is_recurring) === 1 } : null;
  },
  update(
    userId: number,
    id: number,
    input: Partial<{
      name: string;
      description: string;
      category: string;
      title: string;
      notes: string;
      priority: Priority;
      is_recurring: boolean;
      recurrence_pattern: RecurrencePattern | null;
      reminder_minutes: number | null;
      due_date_offset_days: number | null;
      subtasks: { title: string; position: number }[];
    }>,
  ): Template | null {
    const existing = this.getById(userId, id);
    if (!existing) return null;
    const now = getSingaporeNow().toISOString();

    db
      .prepare(
        `UPDATE templates
         SET name = ?, description = ?, category = ?, title = ?, notes = ?, priority = ?,
             is_recurring = ?, recurrence_pattern = ?, reminder_minutes = ?, due_date_offset_days = ?,
             subtasks_json = ?, updated_at = ?
         WHERE user_id = ? AND id = ?`,
      )
      .run(
        input.name?.trim() ?? existing.name,
        input.description ?? existing.description,
        input.category ?? existing.category,
        input.title?.trim() ?? existing.title,
        input.notes ?? existing.notes,
        input.priority ?? existing.priority,
        input.is_recurring !== undefined ? (input.is_recurring ? 1 : 0) : (existing.is_recurring ? 1 : 0),
        input.recurrence_pattern !== undefined ? input.recurrence_pattern : existing.recurrence_pattern,
        input.reminder_minutes !== undefined ? input.reminder_minutes : existing.reminder_minutes,
        input.due_date_offset_days !== undefined ? input.due_date_offset_days : existing.due_date_offset_days,
        input.subtasks ? JSON.stringify(input.subtasks) : existing.subtasks_json,
        now,
        userId,
        id,
      );

    return this.getById(userId, id);
  },
  delete(userId: number, id: number): boolean {
    const result = db.prepare('DELETE FROM templates WHERE user_id = ? AND id = ?').run(userId, id);
    return result.changes > 0;
  },
};

export const holidayDB = {
  getByMonth(month: string): Holiday[] {
    return db
      .prepare('SELECT * FROM holidays WHERE date LIKE ? ORDER BY date ASC')
      .all(`${month}-%`) as Holiday[];
  },
  upsert(date: string, name: string): void {
    db.prepare('INSERT OR IGNORE INTO holidays (date, name) VALUES (?, ?)').run(date, name);
  },
};

export default db;
