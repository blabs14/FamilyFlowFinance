import { useEffect, useRef } from 'react';
import { useReminders } from './useRemindersQuery';
import { getReminderDate } from '../lib/dateUtils';

function getTodayKey(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function isLocalRemindersEnabled(): boolean {
  try {
    const raw = localStorage.getItem('local_reminders_enabled');
    if (raw == null) return true; // default ligado
    return raw === '1' || raw === 'true';
  } catch {
    return true;
  }
}

function loadNotifiedSet(): Set<string> {
  try {
    const todayKey = getTodayKey();
    const raw = localStorage.getItem('reminders_notified');
    if (!raw) return new Set();
    const parsed = JSON.parse(raw) as Record<string, unknown>;
     const date = typeof parsed.date === 'string' ? parsed.date : '';
     const ids = Array.isArray(parsed.ids) ? parsed.ids.filter((id): id is string => typeof id === 'string') : [];
     if (date !== todayKey) return new Set();
     return new Set(ids);
  } catch {
    return new Set();
  }
}

function saveNotifiedSet(set: Set<string>): void {
  try {
    const todayKey = getTodayKey();
    const ids = Array.from(set);
    localStorage.setItem('reminders_notified', JSON.stringify({ date: todayKey, ids }));
  } catch {
    // ignore
  }
}

// Removidas funções locais coerceDate/getReminderDate — usamos util de dateUtils

function getReminderTime(reminder: Record<string, unknown>): string | null {
  // Se houver hora específica, usar (ex.: hora_lembrete)
  const maybe = (reminder as any).hora_lembrete;
  if (typeof maybe === 'string' && maybe.trim()) return maybe.trim();
  return null;
}

function combineDateAndTime(date: Date, timeHHmm: string | null): Date {
  const target = new Date(date);
  if (timeHHmm && /^\d{2}:\d{2}$/.test(timeHHmm)) {
    const [hh, mm] = timeHHmm.split(':').map((x) => parseInt(x, 10));
    target.setHours(hh, mm, 0, 0);
  } else {
    // default 09:00
    target.setHours(9, 0, 0, 0);
  }
  return target;
}

async function showBrowserNotification(title: string, body?: string): Promise<void> {
  try {
    if (!('Notification' in window)) return;
    if (Notification.permission !== 'granted') return;

    const registration = await navigator.serviceWorker?.ready.catch(() => undefined);
    if (registration && 'showNotification' in registration) {
      await registration.showNotification(title, {
        body,
        icon: '/favicon.ico',
        badge: '/favicon.ico',
        tag: `reminder-${title}-${Date.now()}`,
        renotify: false,
        silent: false,
      });
      return;
    }

    // Fallback
    new Notification(title, { body });
  } catch {
    // ignore errors
  }
}

export function useDailyReminderNotifications(): void {
  const { data: reminders } = useReminders();
  const intervalRef = useRef<number | null>(null);

  useEffect(() => {
    // Pedir permissão de forma educada (apenas 1x), somente se toggle estiver ativo
    try {
      if (!isLocalRemindersEnabled()) return;
      if (!('Notification' in window)) return;
      const flagKey = 'notifications_permission_requested';
      const already = localStorage.getItem(flagKey);
      if (!already && Notification.permission === 'default') {
        Notification.requestPermission().finally(() => {
          localStorage.setItem(flagKey, '1');
        });
      }
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    // Limpar intervalo anterior
    if (intervalRef.current) {
      window.clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    // Toggle global
    if (!isLocalRemindersEnabled()) return;

    // Se não há lembretes, não iniciar intervalo
    if (!Array.isArray(reminders) || reminders.length === 0) return;

    const tick = async () => {
      if (!isLocalRemindersEnabled()) return; // revalidar em runtime
      const now = new Date();
      const notified = loadNotifiedSet();

      for (const r of reminders as unknown as Record<string, unknown>[]) {
        const id = String((r as any).id ?? '');
        if (!id || notified.has(id)) continue;

        const dateOnly = getReminderDate(r);
        if (!dateOnly) continue;

        // Só hoje
        const sameDay = dateOnly.getFullYear() === now.getFullYear()
          && dateOnly.getMonth() === now.getMonth()
          && dateOnly.getDate() === now.getDate();
        if (!sameDay) continue;

        const time = getReminderTime(r);
        const target = combineDateAndTime(dateOnly, time);

        // Se a hora já passou mais de 2 horas, ignorar (evitar spam ao abrir página à noite)
        const diffMs = target.getTime() - now.getTime();
        if (diffMs < -2 * 60 * 60 * 1000) continue;

        // Disparar notificação quando dentro do minuto atual (|diff| <= 30s)
        if (Math.abs(diffMs) <= 30 * 1000 || diffMs < 0) {
          const title = String((r as any).title ?? (r as any).titulo ?? 'Lembrete');
          const body = String((r as any).description ?? (r as any).descricao ?? '');
          await showBrowserNotification(title, body);
          notified.add(id);
        }
      }

      saveNotifiedSet(notified);
    };

    // Tick imediato e depois a cada 30s
    void tick();
    intervalRef.current = window.setInterval(() => void tick(), 30 * 1000) as unknown as number;

    return () => {
      if (intervalRef.current) {
        window.clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [reminders]);
}