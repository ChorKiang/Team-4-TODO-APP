'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { PRIORITY_WEIGHT, PRESET_COLORS, REMINDER_OPTIONS, VALID_REMINDER_MINUTES } from '@/lib/constants';
import { formatSingaporeDate, fromDateTimeLocal, toDateTimeLocalValue } from '@/lib/timezone';
import { useNotifications } from '@/lib/hooks/useNotifications';

type Priority = 'high' | 'medium' | 'low';
type RecurrencePattern = 'daily' | 'weekly' | 'monthly' | 'yearly';

type Subtask = {
  id: number;
  todo_id: number;
  title: string;
  completed: boolean;
  position: number;
};

type Tag = {
  id: number;
  name: string;
  color: string;
};

type Todo = {
  id: number;
  title: string;
  description: string | null;
  completed: boolean;
  due_date: string | null;
  priority: Priority;
  is_recurring: boolean;
  recurrence_pattern: RecurrencePattern | null;
  reminder_minutes: number | null;
  subtasks: Subtask[];
  tags: Tag[];
  created_at: string;
  updated_at: string;
};

type Template = {
  id: number;
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
};

type TodoDraft = {
  id?: number;
  title: string;
  description: string;
  dueDateLocal: string;
  priority: Priority;
  isRecurring: boolean;
  recurrencePattern: RecurrencePattern;
  reminderMinutes: number | null;
  tagIds: number[];
};

const defaultDraft: TodoDraft = {
  title: '',
  description: '',
  dueDateLocal: '',
  priority: 'medium',
  isRecurring: false,
  recurrencePattern: 'daily',
  reminderMinutes: null,
  tagIds: [],
};

function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

function calculateProgress(subtasks: Subtask[]) {
  const total = subtasks.length;
  const completed = subtasks.filter((s) => s.completed).length;
  const percent = total === 0 ? 0 : Math.round((completed / total) * 100);
  return { total, completed, percent };
}

function sortTodos(todos: Todo[]) {
  return [...todos].sort((a, b) => {
    const pw = PRIORITY_WEIGHT[a.priority] - PRIORITY_WEIGHT[b.priority];
    if (pw !== 0) return pw;

    if (a.due_date && b.due_date) {
      return new Date(a.due_date).getTime() - new Date(b.due_date).getTime();
    }

    if (a.due_date) return -1;
    if (b.due_date) return 1;

    return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
  });
}

function isOverdue(todo: Todo) {
  return !todo.completed && !!todo.due_date && new Date(todo.due_date).getTime() < Date.now();
}

function PriorityBadge({ priority }: { priority: Priority }) {
  const styles: Record<Priority, string> = {
    high: 'bg-red-100 text-red-800',
    medium: 'bg-amber-100 text-amber-800',
    low: 'bg-blue-100 text-blue-800',
  };

  return <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${styles[priority]}`}>{priority}</span>;
}

function TagBadge({ tag, onClick }: { tag: Tag; onClick?: () => void }) {
  return (
    <button
      type="button"
      className="px-2 py-0.5 rounded-full text-xs font-medium text-white"
      style={{ backgroundColor: tag.color }}
      onClick={onClick}
    >
      {tag.name}
    </button>
  );
}

export default function HomePage() {
  const router = useRouter();
  const { permission, requestPermission, startPolling, stopPolling } = useNotifications();

  const [username, setUsername] = useState('');
  const [todos, setTodos] = useState<Todo[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);

  const [rawSearch, setRawSearch] = useState('');
  const searchQuery = useDebounce(rawSearch, 300);
  const [priorityFilter, setPriorityFilter] = useState<Priority | 'all'>('all');
  const [activeTagFilter, setActiveTagFilter] = useState<Tag | null>(null);

  const [draft, setDraft] = useState<TodoDraft>(defaultDraft);
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const [expanded, setExpanded] = useState<Record<number, boolean>>({});
  const [subtaskInput, setSubtaskInput] = useState<Record<number, string>>({});

  const [tagModal, setTagModal] = useState(false);
  const [newTagName, setNewTagName] = useState('');
  const [newTagColor, setNewTagColor] = useState('#3B82F6');

  const [templateModal, setTemplateModal] = useState(false);
  const [templateCategoryFilter, setTemplateCategoryFilter] = useState('');

  const fetchUser = useCallback(async () => {
    const res = await fetch('/api/auth/me');
    if (!res.ok) {
      router.replace('/login');
      return;
    }

    const data = await res.json();
    setUsername(data.username);
  }, [router]);

  const fetchTodos = useCallback(async () => {
    const res = await fetch('/api/todos', { cache: 'no-store' });
    if (res.ok) {
      const data = await res.json();
      setTodos(data.todos ?? []);
    }
  }, []);

  const fetchTags = useCallback(async () => {
    const res = await fetch('/api/tags');
    if (res.ok) {
      const data = await res.json();
      const loaded: Tag[] = data.tags ?? [];
      setTags(loaded);
      if (activeTagFilter && !loaded.some((tag) => tag.id === activeTagFilter.id)) {
        setActiveTagFilter(null);
      }
    }
  }, [activeTagFilter]);

  const fetchTemplates = useCallback(async () => {
    const res = await fetch('/api/templates');
    if (res.ok) {
      const data = await res.json();
      setTemplates(data.templates ?? []);
    }
  }, []);

  useEffect(() => {
    void fetchUser();
    void fetchTodos();
    void fetchTags();
    void fetchTemplates();
  }, [fetchUser, fetchTodos, fetchTags, fetchTemplates]);

  useEffect(() => {
    if (permission === 'granted') {
      startPolling();
    } else {
      stopPolling();
    }
    return () => stopPolling();
  }, [permission, startPolling, stopPolling]);

  const applyFilters = useCallback((list: Todo[]) => {
    return list.filter((todo) => {
      if (searchQuery.trim()) {
        const q = searchQuery.trim().toLowerCase();
        const inTitle = todo.title.toLowerCase().includes(q);
        const inTags = todo.tags.some((tag) => tag.name.toLowerCase().includes(q));
        if (!inTitle && !inTags) return false;
      }

      if (priorityFilter !== 'all' && todo.priority !== priorityFilter) return false;
      if (activeTagFilter && !todo.tags.some((tag) => tag.id === activeTagFilter.id)) return false;

      return true;
    });
  }, [searchQuery, priorityFilter, activeTagFilter]);

  const filteredTodos = useMemo(() => applyFilters(todos), [todos, applyFilters]);

  const overdueTodos = useMemo(() => sortTodos(filteredTodos.filter((todo) => isOverdue(todo))), [filteredTodos]);
  const activeTodos = useMemo(
    () => sortTodos(filteredTodos.filter((todo) => !todo.completed && !isOverdue(todo))),
    [filteredTodos],
  );
  const completedTodos = useMemo(
    () =>
      [...filteredTodos.filter((todo) => todo.completed)].sort(
        (a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime(),
      ),
    [filteredTodos],
  );

  const startCreate = () => {
    setDraft(defaultDraft);
    setShowForm(true);
    setError('');
  };

  const startEdit = (todo: Todo) => {
    setDraft({
      id: todo.id,
      title: todo.title,
      description: todo.description ?? '',
      dueDateLocal: toDateTimeLocalValue(todo.due_date),
      priority: todo.priority,
      isRecurring: todo.is_recurring,
      recurrencePattern: todo.recurrence_pattern ?? 'daily',
      reminderMinutes: todo.reminder_minutes,
      tagIds: todo.tags.map((tag) => tag.id),
    });
    setShowForm(true);
    setError('');
  };

  const submitDraft = async () => {
    const title = draft.title.trim();
    if (!title) {
      setError('Title is required');
      return;
    }

    if (title.length > 500) {
      setError('Title is too long');
      return;
    }

    if (draft.reminderMinutes != null && !VALID_REMINDER_MINUTES.includes(draft.reminderMinutes)) {
      setError('Invalid reminder value');
      return;
    }

    if (draft.isRecurring && !draft.dueDateLocal) {
      setError('Recurring todos require due date');
      return;
    }

    setSaving(true);
    setError('');

    const payload = {
      title,
      description: draft.description.trim() || null,
      due_date: fromDateTimeLocal(draft.dueDateLocal) ?? null,
      priority: draft.priority,
      is_recurring: draft.isRecurring,
      recurrence_pattern: draft.isRecurring ? draft.recurrencePattern : null,
      reminder_minutes: draft.dueDateLocal ? draft.reminderMinutes : null,
      tagIds: draft.tagIds,
    };

    if (!draft.id) {
      const optimistic: Todo = {
        id: -Date.now(),
        title: payload.title,
        description: payload.description,
        due_date: payload.due_date,
        completed: false,
        priority: payload.priority,
        is_recurring: payload.is_recurring,
        recurrence_pattern: payload.recurrence_pattern,
        reminder_minutes: payload.reminder_minutes,
        subtasks: [],
        tags: tags.filter((tag) => draft.tagIds.includes(tag.id)),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      setTodos((prev) => [optimistic, ...prev]);

      const res = await fetch('/api/todos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const data = await res.json();
        setTodos((prev) => prev.filter((todo) => todo.id !== optimistic.id));
        setError(data.error ?? 'Failed to create todo');
        setSaving(false);
        return;
      }

      const created = (await res.json()) as Todo;
      setTodos((prev) => prev.map((todo) => (todo.id === optimistic.id ? created : todo)));
    } else {
      const backup = todos;
      setTodos((prev) =>
        prev.map((todo) =>
          todo.id === draft.id
            ? {
                ...todo,
                ...payload,
                tags: tags.filter((tag) => draft.tagIds.includes(tag.id)),
                is_recurring: payload.is_recurring,
                recurrence_pattern: payload.recurrence_pattern,
                reminder_minutes: payload.reminder_minutes,
              }
            : todo,
        ),
      );

      const res = await fetch(`/api/todos/${draft.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const data = await res.json();
        setTodos(backup);
        setError(data.error ?? 'Failed to update todo');
        setSaving(false);
        return;
      }
    }

    await fetchTodos();
    setShowForm(false);
    setSaving(false);
  };

  const toggleTodo = async (todo: Todo) => {
    const previous = todos;
    setTodos((prev) => prev.map((item) => (item.id === todo.id ? { ...item, completed: !item.completed } : item)));

    const res = await fetch(`/api/todos/${todo.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ completed: !todo.completed }),
    });

    if (!res.ok) {
      setTodos(previous);
      return;
    }

    await fetchTodos();
  };

  const deleteTodo = async (todoId: number) => {
    if (!window.confirm('Delete this todo?')) return;

    const previous = todos;
    setTodos((prev) => prev.filter((todo) => todo.id !== todoId));
    const res = await fetch(`/api/todos/${todoId}`, { method: 'DELETE' });
    if (!res.ok) {
      setTodos(previous);
    }
  };

  const addSubtask = async (todoId: number) => {
    const title = (subtaskInput[todoId] ?? '').trim();
    if (!title) return;

    const res = await fetch(`/api/todos/${todoId}/subtasks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title }),
    });

    if (res.ok) {
      setSubtaskInput((prev) => ({ ...prev, [todoId]: '' }));
      await fetchTodos();
    }
  };

  const toggleSubtask = async (subtaskId: number, completed: boolean) => {
    const res = await fetch(`/api/subtasks/${subtaskId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ completed }),
    });

    if (res.ok) {
      await fetchTodos();
    }
  };

  const deleteSubtask = async (subtaskId: number) => {
    const res = await fetch(`/api/subtasks/${subtaskId}`, { method: 'DELETE' });
    if (res.ok) {
      await fetchTodos();
    }
  };

  const createTag = async () => {
    if (!newTagName.trim()) return;
    const res = await fetch('/api/tags', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newTagName.trim(), color: newTagColor }),
    });

    if (res.ok) {
      setNewTagName('');
      await fetchTags();
    }
  };

  const updateTag = async (tag: Tag) => {
    const name = window.prompt('New tag name', tag.name);
    if (!name) return;
    const color = window.prompt('Tag color hex (e.g. #3B82F6)', tag.color) || tag.color;

    const res = await fetch(`/api/tags/${tag.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, color }),
    });

    if (res.ok) {
      await fetchTags();
      await fetchTodos();
    }
  };

  const removeTag = async (tag: Tag) => {
    if (!window.confirm(`Delete tag ${tag.name}?`)) return;

    const res = await fetch(`/api/tags/${tag.id}`, { method: 'DELETE' });
    if (res.ok) {
      await fetchTags();
      await fetchTodos();
    }
  };

  const saveAsTemplate = async (todo: Todo) => {
    const name = window.prompt('Template name', todo.title);
    if (!name?.trim()) return;
    const description = window.prompt('Template description (optional)', '') || '';
    const category = window.prompt('Template category (optional)', '') || '';

    let dueDateOffsetDays: number | null = null;
    if (todo.due_date) {
      const diff = new Date(todo.due_date).getTime() - Date.now();
      dueDateOffsetDays = Math.max(0, Math.round(diff / 86_400_000));
    }

    await fetch('/api/templates', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: name.trim(),
        description,
        category,
        title: todo.title,
        notes: todo.description,
        priority: todo.priority,
        is_recurring: todo.is_recurring,
        recurrence_pattern: todo.recurrence_pattern,
        reminder_minutes: todo.reminder_minutes,
        due_date_offset_days: dueDateOffsetDays,
        subtasks: todo.subtasks.map((subtask, index) => ({ title: subtask.title, position: index })),
      }),
    });

    await fetchTemplates();
  };

  const applyTemplate = async (templateId: number) => {
    const res = await fetch(`/api/templates/${templateId}/use`, { method: 'POST' });
    if (res.ok) {
      await fetchTodos();
      setTemplateModal(false);
    }
  };

  const editTemplate = async (template: Template) => {
    const name = window.prompt('Template name', template.name);
    if (!name) return;
    const description = window.prompt('Template description', template.description ?? '') ?? template.description;
    const category = window.prompt('Template category', template.category ?? '') ?? template.category;

    const res = await fetch(`/api/templates/${template.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, description, category }),
    });

    if (res.ok) {
      await fetchTemplates();
    }
  };

  const removeTemplate = async (template: Template) => {
    if (!window.confirm(`Delete template ${template.name}?`)) return;
    const res = await fetch(`/api/templates/${template.id}`, { method: 'DELETE' });
    if (res.ok) {
      await fetchTemplates();
    }
  };

  const handleExport = async () => {
    const res = await fetch('/api/todos/export');
    if (!res.ok) return;

    const data = await res.json();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `todos-export-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      const res = await fetch('/api/todos/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(parsed),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(`Import failed: ${data.error ?? 'unknown error'}`);
      } else {
        setError('');
        await fetchTodos();
        await fetchTags();
      }
    } catch {
      setError('Import failed: invalid JSON file');
    } finally {
      event.target.value = '';
    }
  };

  const clearAllFilters = () => {
    setRawSearch('');
    setPriorityFilter('all');
    setActiveTagFilter(null);
  };

  const hasActiveFilters = rawSearch !== '' || priorityFilter !== 'all' || activeTagFilter !== null;

  const logout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
  };

  const filteredTemplates = templates.filter((template) => {
    if (!templateCategoryFilter) return true;
    return template.category === templateCategoryFilter;
  });

  const categories = [...new Set(templates.map((template) => template.category).filter(Boolean))] as string[];

  const renderTodoCard = (todo: Todo) => {
    const progress = calculateProgress(todo.subtasks);
    const reminderLabel = REMINDER_OPTIONS.find((option) => option.value === todo.reminder_minutes)?.label;

    return (
      <article key={todo.id} className="panel p-3 fade-in">
        <div className="flex items-start gap-3">
          <input type="checkbox" checked={todo.completed} onChange={() => void toggleTodo(todo)} className="mt-1" />
          <div className="flex-1">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className={`font-medium ${todo.completed ? 'line-through text-gray-400' : ''}`}>{todo.title}</p>
                {todo.description && <p className="text-sm mt-1" style={{ color: 'var(--muted)' }}>{todo.description}</p>}
              </div>

              <div className="flex items-center gap-1 shrink-0">
                <button className="btn btn-secondary !px-2 !py-1" onClick={() => startEdit(todo)}>Edit</button>
                <button className="btn btn-danger !px-2 !py-1" onClick={() => void deleteTodo(todo.id)}>Delete</button>
              </div>
            </div>

            <div className="mt-2 flex flex-wrap items-center gap-2">
              <PriorityBadge priority={todo.priority} />
              {todo.due_date && <span className="text-xs">Due: {formatSingaporeDate(todo.due_date)}</span>}
              {todo.is_recurring && (
                <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-700">
                  Repeat: {todo.recurrence_pattern}
                </span>
              )}
              {todo.reminder_minutes && (
                <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-700">
                  Reminder: {reminderLabel ?? `${todo.reminder_minutes}m before`}
                </span>
              )}
            </div>

            {todo.tags.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1">
                {todo.tags.map((tag) => (
                  <TagBadge key={tag.id} tag={tag} onClick={() => setActiveTagFilter(tag)} />
                ))}
              </div>
            )}

            <div className="mt-2 flex gap-2">
              <button
                className="btn btn-secondary !px-2 !py-1"
                onClick={() => setExpanded((prev) => ({ ...prev, [todo.id]: !prev[todo.id] }))}
              >
                Subtasks {expanded[todo.id] ? '▲' : '▼'}
              </button>
              <button className="btn btn-secondary !px-2 !py-1" onClick={() => void saveAsTemplate(todo)}>
                Save as Template
              </button>
            </div>

            {progress.total > 0 && (
              <div className="mt-2">
                <p className="text-xs mb-1" style={{ color: 'var(--muted)' }}>
                  {progress.completed}/{progress.total} completed ({progress.percent}%)
                </p>
                <div className="w-full h-2 rounded-full bg-gray-200">
                  <div
                    className={`h-2 rounded-full transition-all ${progress.percent === 100 ? 'bg-emerald-500' : 'bg-blue-500'}`}
                    style={{ width: `${progress.percent}%` }}
                  />
                </div>
              </div>
            )}

            {expanded[todo.id] && (
              <div className="mt-3 space-y-2">
                {todo.subtasks.map((subtask) => (
                  <div key={subtask.id} className="flex items-center gap-2 group">
                    <input
                      type="checkbox"
                      checked={subtask.completed}
                      onChange={() => void toggleSubtask(subtask.id, !subtask.completed)}
                    />
                    <p className={`text-sm flex-1 ${subtask.completed ? 'line-through text-gray-400' : ''}`}>
                      {subtask.title}
                    </p>
                    <button className="text-sm text-red-600" onClick={() => void deleteSubtask(subtask.id)}>
                      Remove
                    </button>
                  </div>
                ))}

                <div className="flex gap-2">
                  <input
                    className="input"
                    value={subtaskInput[todo.id] ?? ''}
                    onChange={(event) =>
                      setSubtaskInput((prev) => ({
                        ...prev,
                        [todo.id]: event.target.value,
                      }))
                    }
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') {
                        event.preventDefault();
                        void addSubtask(todo.id);
                      }
                    }}
                    placeholder="Add a subtask..."
                  />
                  <button className="btn btn-primary" onClick={() => void addSubtask(todo.id)}>
                    Add
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </article>
    );
  };

  return (
    <main className="min-h-screen p-4 md:p-8">
      <div className="max-w-6xl mx-auto space-y-4">
        <header className="panel p-4 fade-in">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="text-3xl font-bold tracking-tight">Todo Workspace</h1>
              <p className="text-sm" style={{ color: 'var(--muted)' }}>Signed in as {username}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {permission !== 'granted' && typeof Notification !== 'undefined' && (
                <button className="btn btn-secondary" onClick={() => void requestPermission()}>
                  Enable Notifications
                </button>
              )}
              <button className="btn btn-secondary" onClick={() => setTagModal(true)}>Manage Tags</button>
              <button className="btn btn-secondary" onClick={() => setTemplateModal(true)}>Use Template</button>
              <button className="btn btn-secondary" onClick={() => void handleExport()}>Export</button>
              <label className="btn btn-secondary">
                Import
                <input type="file" accept=".json" className="hidden" onChange={(event) => void handleImport(event)} />
              </label>
              <Link href="/calendar" className="btn btn-secondary">Calendar</Link>
              <button className="btn btn-danger" onClick={() => void logout()}>Logout</button>
            </div>
          </div>

          <div className="grid md:grid-cols-3 gap-2 mt-3">
            <div className="relative md:col-span-2">
              <input
                type="search"
                className="input pr-10"
                value={rawSearch}
                onChange={(event) => setRawSearch(event.target.value)}
                placeholder="Search by title or tag..."
                aria-label="Search todos"
              />
              {rawSearch && (
                <button
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-sm"
                  onClick={() => setRawSearch('')}
                  aria-label="Clear search"
                >
                  X
                </button>
              )}
            </div>
            <select
              className="select"
              aria-label="Filter by priority"
              value={priorityFilter}
              onChange={(event) => setPriorityFilter(event.target.value as Priority | 'all')}
            >
              <option value="all">All Priorities</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
          </div>

          {hasActiveFilters && (
            <div className="flex flex-wrap items-center gap-2 mt-3">
              {searchQuery && (
                <span className="text-xs px-2 py-1 rounded-full bg-gray-100">
                  Search: {searchQuery}
                  <button className="ml-2" onClick={() => setRawSearch('')}>X</button>
                </span>
              )}
              {priorityFilter !== 'all' && (
                <span className="text-xs px-2 py-1 rounded-full bg-gray-100">
                  Priority: {priorityFilter}
                  <button className="ml-2" onClick={() => setPriorityFilter('all')}>X</button>
                </span>
              )}
              {activeTagFilter && (
                <span className="text-xs px-2 py-1 rounded-full bg-gray-100">
                  Tag: {activeTagFilter.name}
                  <button className="ml-2" onClick={() => setActiveTagFilter(null)}>X</button>
                </span>
              )}
              <button className="text-sm text-red-700" onClick={clearAllFilters}>Clear all</button>
            </div>
          )}

          <div className="mt-4">
            <button className="btn btn-primary" onClick={startCreate}>New Todo</button>
          </div>

          {error && <p className="mt-3 text-sm text-red-700">{error}</p>}
        </header>

        {showForm && (
          <section className="panel p-4 fade-in">
            <h2 className="text-xl font-semibold mb-3">{draft.id ? 'Edit Todo' : 'Create Todo'}</h2>
            <div className="grid md:grid-cols-2 gap-3">
              <div className="md:col-span-2">
                <label className="text-sm font-medium">Title</label>
                <input
                  className="input mt-1"
                  value={draft.title}
                  onChange={(event) => setDraft((prev) => ({ ...prev, title: event.target.value }))}
                />
              </div>
              <div className="md:col-span-2">
                <label className="text-sm font-medium">Description</label>
                <textarea
                  className="textarea mt-1"
                  rows={3}
                  value={draft.description}
                  onChange={(event) => setDraft((prev) => ({ ...prev, description: event.target.value }))}
                />
              </div>
              <div>
                <label className="text-sm font-medium">Due Date</label>
                <input
                  type="datetime-local"
                  className="input mt-1"
                  value={draft.dueDateLocal}
                  onChange={(event) => setDraft((prev) => ({ ...prev, dueDateLocal: event.target.value }))}
                />
              </div>
              <div>
                <label className="text-sm font-medium">Priority</label>
                <select
                  className="select mt-1"
                  value={draft.priority}
                  onChange={(event) =>
                    setDraft((prev) => ({
                      ...prev,
                      priority: event.target.value as Priority,
                    }))
                  }
                >
                  <option value="high">High</option>
                  <option value="medium">Medium</option>
                  <option value="low">Low</option>
                </select>
              </div>
              <div>
                <label className="text-sm font-medium">Reminder</label>
                <select
                  className="select mt-1"
                  value={draft.reminderMinutes ?? ''}
                  disabled={!draft.dueDateLocal}
                  onChange={(event) =>
                    setDraft((prev) => ({
                      ...prev,
                      reminderMinutes: event.target.value ? Number(event.target.value) : null,
                    }))
                  }
                >
                  {REMINDER_OPTIONS.map((option) => (
                    <option key={option.label} value={option.value ?? ''}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-sm font-medium block">Repeat</label>
                <div className="mt-2 flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={draft.isRecurring}
                    onChange={(event) =>
                      setDraft((prev) => ({
                        ...prev,
                        isRecurring: event.target.checked,
                      }))
                    }
                  />
                  <span className="text-sm">Enable recurrence</span>
                </div>
              </div>

              {draft.isRecurring && (
                <div>
                  <label className="text-sm font-medium">Recurrence Pattern</label>
                  <select
                    className="select mt-1"
                    value={draft.recurrencePattern}
                    onChange={(event) =>
                      setDraft((prev) => ({
                        ...prev,
                        recurrencePattern: event.target.value as RecurrencePattern,
                      }))
                    }
                  >
                    <option value="daily">Daily</option>
                    <option value="weekly">Weekly</option>
                    <option value="monthly">Monthly</option>
                    <option value="yearly">Yearly</option>
                  </select>
                </div>
              )}
            </div>

            <div className="mt-3">
              <label className="text-sm font-medium">Tags</label>
              <div className="flex flex-wrap gap-2 mt-2">
                {tags.length === 0 && <p className="text-sm" style={{ color: 'var(--muted)' }}>No tags yet.</p>}
                {tags.map((tag) => {
                  const checked = draft.tagIds.includes(tag.id);
                  return (
                    <label key={tag.id} className="flex items-center gap-1.5">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => {
                          setDraft((prev) => ({
                            ...prev,
                            tagIds: checked
                              ? prev.tagIds.filter((id) => id !== tag.id)
                              : [...prev.tagIds, tag.id],
                          }));
                        }}
                      />
                      <TagBadge tag={tag} />
                    </label>
                  );
                })}
              </div>
            </div>

            <div className="mt-4 flex gap-2">
              <button className="btn btn-primary" disabled={saving} onClick={() => void submitDraft()}>
                {saving ? 'Saving...' : 'Save'}
              </button>
              <button className="btn btn-secondary" onClick={() => setShowForm(false)}>Cancel</button>
            </div>
          </section>
        )}

        {filteredTodos.length === 0 && todos.length > 0 && (
          <section className="panel p-8 text-center">
            <p className="text-lg">No todos match your filters.</p>
            <button className="text-sm text-red-700 mt-2" onClick={clearAllFilters}>Clear filters</button>
          </section>
        )}

        {todos.length === 0 && (
          <section className="panel p-8 text-center">
            <p className="text-lg">Create your first todo.</p>
          </section>
        )}

        {overdueTodos.length > 0 && (
          <section className="space-y-2">
            <h2 className="text-xl font-semibold text-red-700">Overdue ({overdueTodos.length})</h2>
            {overdueTodos.map(renderTodoCard)}
          </section>
        )}

        <section className="space-y-2">
          <h2 className="text-xl font-semibold">Active ({activeTodos.length})</h2>
          {activeTodos.map(renderTodoCard)}
        </section>

        <section className="space-y-2">
          <h2 className="text-xl font-semibold">Completed ({completedTodos.length})</h2>
          {completedTodos.map(renderTodoCard)}
        </section>
      </div>

      {tagModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4" onClick={() => setTagModal(false)}>
          <section className="panel w-full max-w-lg p-5" onClick={(event) => event.stopPropagation()}>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xl font-semibold">Manage Tags</h3>
              <button className="btn btn-secondary" onClick={() => setTagModal(false)}>Close</button>
            </div>

            <div className="grid grid-cols-[1fr_auto_auto] gap-2 mb-4">
              <input
                className="input"
                placeholder="Tag name"
                value={newTagName}
                onChange={(event) => setNewTagName(event.target.value)}
              />
              <input
                type="color"
                className="h-10 w-12"
                value={newTagColor}
                onChange={(event) => setNewTagColor(event.target.value)}
              />
              <button className="btn btn-primary" onClick={() => void createTag()}>Create</button>
            </div>

            <div className="flex gap-2 flex-wrap mb-3">
              {PRESET_COLORS.map((color) => (
                <button
                  key={color}
                  className="w-7 h-7 rounded-full border"
                  style={{ backgroundColor: color }}
                  onClick={() => setNewTagColor(color)}
                />
              ))}
            </div>

            <div className="space-y-2 max-h-64 overflow-auto">
              {tags.map((tag) => (
                <div key={tag.id} className="flex items-center justify-between border rounded p-2">
                  <TagBadge tag={tag} />
                  <div className="flex gap-2">
                    <button className="btn btn-secondary !px-2 !py-1" onClick={() => void updateTag(tag)}>Edit</button>
                    <button className="btn btn-danger !px-2 !py-1" onClick={() => void removeTag(tag)}>Delete</button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>
      )}

      {templateModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4" onClick={() => setTemplateModal(false)}>
          <section className="panel w-full max-w-2xl p-5" onClick={(event) => event.stopPropagation()}>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xl font-semibold">Use Template</h3>
              <button className="btn btn-secondary" onClick={() => setTemplateModal(false)}>Close</button>
            </div>

            <select
              className="select mb-3"
              value={templateCategoryFilter}
              onChange={(event) => setTemplateCategoryFilter(event.target.value)}
            >
              <option value="">All Categories</option>
              {categories.map((category) => (
                <option key={category} value={category}>{category}</option>
              ))}
            </select>

            <div className="space-y-2 max-h-80 overflow-auto">
              {filteredTemplates.map((template) => {
                const subtasks = JSON.parse(template.subtasks_json ?? '[]') as Array<{ title: string }>;
                const reminder = REMINDER_OPTIONS.find((option) => option.value === template.reminder_minutes)?.label;

                return (
                  <div key={template.id} className="border rounded-md p-3 bg-white">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-semibold">{template.name}</p>
                        <p className="text-sm" style={{ color: 'var(--muted)' }}>{template.title}</p>
                        <p className="text-xs mt-1" style={{ color: 'var(--muted)' }}>
                          Priority: {template.priority} | Recurrence: {template.recurrence_pattern ?? 'none'} | Subtasks: {subtasks.length}
                        </p>
                        <p className="text-xs" style={{ color: 'var(--muted)' }}>
                          Reminder: {reminder ?? 'none'} | Category: {template.category ?? 'none'}
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-1 justify-end">
                        <button className="btn btn-primary !px-2 !py-1" onClick={() => void applyTemplate(template.id)}>Create</button>
                        <button className="btn btn-secondary !px-2 !py-1" onClick={() => void editTemplate(template)}>Edit</button>
                        <button className="btn btn-danger !px-2 !py-1" onClick={() => void removeTemplate(template)}>Delete</button>
                      </div>
                    </div>
                  </div>
                );
              })}
              {filteredTemplates.length === 0 && <p className="text-sm">No templates found.</p>}
            </div>
          </section>
        </div>
      )}
    </main>
  );
}
