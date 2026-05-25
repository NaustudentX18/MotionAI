/**
 * useReminders.ts — HTML5 Notification API for task due-date reminders.
 *
 * Polls every 60 seconds for pages with `reminderDate` within a ±2-minute
 * window and fires a native browser notification. Falls back silently if
 * Notifications are unavailable or permission is denied.
 */

import { useCallback, useEffect, useRef } from 'react';
import type { Page } from '../types';
import type { WorkspaceSnapshot } from '../lib/persistence';

const POLL_INTERVAL_MS = 60_000; // 1 minute
const WINDOW_MS = 2 * 60 * 1000; // ±2 minutes
const REMINDER_FIRED_KEY = 'motionai_fired_reminders';

/** Request notification permission — must be called from a user gesture */
export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (!('Notification' in window)) return 'denied';
  if (Notification.permission === 'granted') return 'granted';
  if (Notification.permission === 'denied') return 'denied';
  return Notification.requestPermission();
}

/** Show a native browser notification (no-op if not permitted) */
export function showNotification(title: string, body: string): void {
  if (!('Notification' in window) || Notification.permission !== 'granted') return;
  try {
    new Notification(title, {
      body,
      tag: `motionai-reminder-${title}`,
      requireInteraction: false,
    });
  } catch {
    // Notifications blocked or restricted (e.g. Firefox private mode)
  }
}

interface UseRemindersOptions {
  /** Current workspace snapshot — must be live-updated by the caller */
  snapshot: WorkspaceSnapshot | null;
  /** Called when a reminder fires (optional extra handler) */
  onReminder?: (title: string, body: string) => void;
}

function parseReminderTime(page: Page): number | null {
  const raw = page.reminderDate;
  if (!raw) return null;
  const due = new Date(raw).getTime();
  return Number.isFinite(due) ? due : null;
}

function loadFiredReminderKeys(): Set<string> {
  try {
    const raw = localStorage.getItem(REMINDER_FIRED_KEY);
    const keys = raw ? JSON.parse(raw) : [];
    return new Set(Array.isArray(keys) ? keys.filter((key): key is string => typeof key === 'string') : []);
  } catch {
    return new Set();
  }
}

function saveFiredReminderKeys(keys: Set<string>): void {
  try {
    localStorage.setItem(REMINDER_FIRED_KEY, JSON.stringify([...keys].slice(-500)));
  } catch {
    // Storage may be unavailable in private mode; session memory still dedupes.
  }
}

/**
 * useReminders — mounts a recurring poll that fires native notifications
 * for tasks whose `reminderDate` falls within the next/current 2-minute window.
 */
export function useReminders({ snapshot, onReminder }: UseRemindersOptions): void {
  const firedRef = useRef<Set<string>>(loadFiredReminderKeys());

  const check = useCallback(() => {
    if (!snapshot) return;
    if (!('Notification' in window) || Notification.permission !== 'granted') return;

    const now = Date.now();

    for (const page of snapshot.pages) {
      const due = parseReminderTime(page);
      if (due === null) continue;

      const diff = due - now;
      // Fire if due within ±WINDOW_MS and not already fired this session
      if (diff >= -WINDOW_MS && diff <= WINDOW_MS) {
        const key = `${page.id}:${due}`;
        if (firedRef.current.has(key)) continue;
        firedRef.current.add(key);
        saveFiredReminderKeys(firedRef.current);

        const title = `⏰ Reminder: ${page.title || 'Untitled'}`;
        const body = diff <= 0 ? 'This reminder was due just now.' : `Due in ${Math.round(diff / 60000)} minute(s).`;

        showNotification(title, body);
        onReminder?.(title, body);
      }
    }
  }, [snapshot, onReminder]);

  useEffect(() => {
    // Run immediately on mount, then on interval
    check();
    const id = setInterval(check, POLL_INTERVAL_MS);
    return () => clearInterval(id);
  }, [check]);
}
