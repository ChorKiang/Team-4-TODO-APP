'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';

type Priority = 'high' | 'medium' | 'low';

type Todo = {
  id: number;
  title: string;
  due_date: string | null;
  completed: boolean;
  priority: Priority;
};

type Holiday = {
  id: number;
  date: string;
  name: string;
};

type CalendarDay = {
  date: Date;
  dateStr: string;
  isCurrentMonth: boolean;
  isToday: boolean;
  isWeekend: boolean;
  todos: Todo[];
  holidays: Holiday[];
};

function toDateStr(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function groupBy<T>(items: T[], keyGetter: (item: T) => string): Record<string, T[]> {
  return items.reduce<Record<string, T[]>>((acc, item) => {
    const key = keyGetter(item);
    if (!acc[key]) acc[key] = [];
    acc[key].push(item);
    return acc;
  }, {});
}

function generateCalendar(year: number, month: number, todos: Todo[], holidays: Holiday[]): CalendarDay[][] {
  const firstDay = new Date(year, month - 1, 1);
  const lastDay = new Date(year, month, 0);
  const todosByDate = groupBy(todos.filter((todo) => todo.due_date), (todo) => String(todo.due_date).slice(0, 10));
  const holidaysByDate = groupBy(holidays, (h) => h.date);
  const today = toDateStr(new Date());

  const weeks: CalendarDay[][] = [];
  let week: CalendarDay[] = [];

  const start = new Date(firstDay);
  start.setDate(start.getDate() - start.getDay());

  const end = new Date(lastDay);
  end.setDate(end.getDate() + (6 - end.getDay()));

  const cursor = new Date(start);
  while (cursor <= end) {
    const dateStr = toDateStr(cursor);
    week.push({
      date: new Date(cursor),
      dateStr,
      isCurrentMonth: cursor.getMonth() === month - 1,
      isToday: dateStr === today,
      isWeekend: cursor.getDay() === 0 || cursor.getDay() === 6,
      todos: todosByDate[dateStr] ?? [],
      holidays: holidaysByDate[dateStr] ?? [],
    });

    if (week.length === 7) {
      weeks.push(week);
      week = [];
    }

    cursor.setDate(cursor.getDate() + 1);
  }

  return weeks;
}

function CalendarPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const monthParam = searchParams.get('month');
  const fallback = new Date();
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [todos, setTodos] = useState<Todo[]>([]);
  const [holidays, setHolidays] = useState<Holiday[]>([]);

  const [year, month] = monthParam && /^\d{4}-\d{2}$/.test(monthParam)
    ? monthParam.split('-').map(Number)
    : [fallback.getFullYear(), fallback.getMonth() + 1];

  const monthLabel = new Date(year, month - 1, 1).toLocaleDateString('en-SG', {
    month: 'long',
    year: 'numeric',
  });

  useEffect(() => {
    const fetchData = async () => {
      const todosRes = await fetch('/api/todos');
      if (todosRes.ok) {
        const data = await todosRes.json();
        setTodos(data.todos ?? []);
      }

      const holidaysRes = await fetch(`/api/holidays?month=${year}-${String(month).padStart(2, '0')}`);
      if (holidaysRes.ok) {
        const holidayData = await holidaysRes.json();
        setHolidays(holidayData.holidays ?? []);
      } else {
        setHolidays([]);
      }
    };
    void fetchData();
  }, [year, month]);

  const weeks = useMemo(() => generateCalendar(year, month, todos, holidays), [year, month, todos, holidays]);
  const selectedDay = weeks.flat().find((d) => d.dateStr === selectedDate) ?? null;

  const navigateMonth = (delta: number) => {
    const target = new Date(year, month - 1 + delta, 1);
    const m = `${target.getFullYear()}-${String(target.getMonth() + 1).padStart(2, '0')}`;
    router.push(`/calendar?month=${m}`);
  };

  return (
    <main className="min-h-screen p-4 md:p-8">
      <div className="max-w-6xl mx-auto panel p-4 md:p-6 fade-in">
        <div className="flex flex-wrap items-center gap-2 justify-between mb-4">
          <div className="flex items-center gap-2">
            <button className="btn btn-secondary" onClick={() => navigateMonth(-1)}>Prev</button>
            <h1 className="text-2xl font-semibold">{monthLabel}</h1>
            <button className="btn btn-secondary" onClick={() => navigateMonth(1)}>Next</button>
          </div>
          <div className="flex items-center gap-2">
            <button
              className="btn btn-secondary"
              onClick={() => router.push(`/calendar?month=${new Date().toISOString().slice(0, 7)}`)}
            >
              Today
            </button>
            <Link href="/" className="btn btn-primary">Back to Todos</Link>
          </div>
        </div>

        <div className="grid grid-cols-7 text-center text-sm font-semibold mb-2" style={{ color: 'var(--muted)' }}>
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
            <div key={day}>{day}</div>
          ))}
        </div>

        <div className="space-y-1">
          {weeks.map((week, weekIdx) => (
            <div key={weekIdx} className="grid grid-cols-7 gap-1">
              {week.map((day) => (
                <button
                  key={day.dateStr}
                  onClick={() => setSelectedDate(day.dateStr)}
                  className={`text-left min-h-24 border rounded-md p-1.5 ${day.isCurrentMonth ? 'bg-white' : 'bg-gray-50 text-gray-400'} ${day.isWeekend && day.isCurrentMonth ? 'bg-orange-50' : ''}`}
                >
                  <span className={`inline-flex w-6 h-6 items-center justify-center rounded-full text-sm ${day.isToday ? 'bg-orange-500 text-white' : ''}`}>
                    {day.date.getDate()}
                  </span>
                  {day.holidays.map((holiday) => (
                    <p key={holiday.id} className="text-xs text-red-700 truncate">{holiday.name}</p>
                  ))}
                  {day.todos.length > 0 && (
                    <span className="inline-flex mt-1 px-1.5 py-0.5 rounded-full text-xs bg-blue-100 text-blue-700">
                      {day.todos.length}
                    </span>
                  )}
                </button>
              ))}
            </div>
          ))}
        </div>
      </div>

      {selectedDay && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4" onClick={() => setSelectedDate(null)}>
          <section className="panel w-full max-w-md p-5" onClick={(event) => event.stopPropagation()}>
            <h2 className="text-xl font-semibold mb-2">
              {selectedDay.date.toLocaleDateString('en-SG', {
                weekday: 'long',
                day: 'numeric',
                month: 'long',
                year: 'numeric',
              })}
            </h2>

            {selectedDay.holidays.map((holiday) => (
              <p key={holiday.id} className="text-red-700 text-sm mb-1">Holiday: {holiday.name}</p>
            ))}

            <div className="space-y-2 my-3 max-h-60 overflow-auto">
              {selectedDay.todos.length === 0 && <p className="text-sm" style={{ color: 'var(--muted)' }}>No todos due this day.</p>}
              {selectedDay.todos.map((todo) => (
                <div key={todo.id} className="border rounded-md p-2 bg-white">
                  <p className={`${todo.completed ? 'line-through text-gray-400' : ''}`}>{todo.title}</p>
                  <p className="text-xs" style={{ color: 'var(--muted)' }}>Priority: {todo.priority}</p>
                </div>
              ))}
            </div>

            <button className="btn btn-secondary" onClick={() => setSelectedDate(null)}>Close</button>
          </section>
        </div>
      )}
    </main>
  );
}

export default function CalendarPage() {
  return (
    <Suspense fallback={<main className="min-h-screen p-8">Loading calendar...</main>}>
      <CalendarPageContent />
    </Suspense>
  );
}
