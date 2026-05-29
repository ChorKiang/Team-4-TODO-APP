'use client';

import { useEffect, useRef, useState } from 'react';

export function useNotifications() {
  const [permission, setPermission] = useState<NotificationPermission>('default');
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined' || typeof Notification === 'undefined') return;
    setPermission(Notification.permission);
  }, []);

  const requestPermission = async () => {
    if (typeof Notification === 'undefined') return;
    const result = await Notification.requestPermission();
    setPermission(result);
  };

  const stopPolling = () => {
    if (timerRef.current) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  const startPolling = () => {
    if (typeof Notification === 'undefined') return;
    stopPolling();
    timerRef.current = window.setInterval(async () => {
      if (Notification.permission !== 'granted') return;
      try {
        const res = await fetch('/api/notifications/check');
        if (!res.ok) return;
        const data = await res.json();
        for (const todo of data.todos ?? []) {
          new Notification('Todo Due Soon', {
            body: `${todo.title} - due ${new Date(todo.due_date).toLocaleTimeString('en-SG')}`,
            icon: '/favicon.ico',
          });
        }
      } catch {
        // Keep polling even when a transient request fails.
      }
    }, 30_000);
  };

  return { permission, requestPermission, startPolling, stopPolling };
}
