import { getAccessToken } from './firebase';

export async function addGoogleCalendarEvent(summary: string, description: string, startTime: Date, endTime: Date) {
  const token = await getAccessToken();
  if (!token) throw new Error('Not authenticated with Google Workspace');

  const res = await fetch('https://www.googleapis.com/calendar/v3/calendars/primary/events', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      summary,
      description,
      start: { dateTime: startTime.toISOString() },
      end: { dateTime: endTime.toISOString() },
    }),
  });

  if (!res.ok) throw new Error('Failed to create calendar event');
  return res.json();
}

export async function addGoogleTask(title: string, notes?: string, dueDate?: Date) {
  const token = await getAccessToken();
  if (!token) throw new Error('Not authenticated with Google Workspace');

  // get default tasklist
  const listsRes = await fetch('https://www.googleapis.com/tasks/v1/users/@me/lists', {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!listsRes.ok) throw new Error('Failed to fetch task lists');
  const listsData = await listsRes.json();
  const defaultList = listsData.items?.[0];
  if (!defaultList) throw new Error('No task list found');

  const payload: any = { title, notes };
  if (dueDate) payload.due = dueDate.toISOString();

  const res = await fetch(`https://www.googleapis.com/tasks/v1/lists/${defaultList.id}/tasks`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) throw new Error('Failed to create task');
  return res.json();
}
