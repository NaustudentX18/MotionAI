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

export interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
}

export async function listGoogleDriveFiles(): Promise<DriveFile[]> {
  const token = await getAccessToken();
  if (!token) throw new Error('Not authenticated with Google Workspace');

  const res = await fetch(
    "https://www.googleapis.com/drive/v3/files?pageSize=30&fields=files(id,name,mimeType)&q=trashed = false and (mimeType = 'application/vnd.google-apps.document' or mimeType = 'text/plain' or mimeType = 'application/json')",
    {
      headers: { Authorization: `Bearer ${token}` },
    }
  );

  if (!res.ok) throw new Error('Failed to list Google Drive files');
  const data = await res.json();
  return data.files || [];
}

export async function getGoogleDriveFileContent(fileId: string, mimeType: string): Promise<string> {
  const token = await getAccessToken();
  if (!token) throw new Error('Not authenticated with Google Workspace');

  let url = `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`;
  if (mimeType === 'application/vnd.google-apps.document') {
    url = `https://www.googleapis.com/drive/v3/files/${fileId}/export?mimeType=text/plain`;
  }

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) throw new Error('Failed to fetch file content');
  return res.text();
}

export async function createGoogleDriveFile(title: string, content: string): Promise<DriveFile> {
  const token = await getAccessToken();
  if (!token) throw new Error('Not authenticated with Google Workspace');

  // Step 1: Create file metadata
  const metaRes = await fetch('https://www.googleapis.com/drive/v3/files', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name: `${title}.txt`,
      mimeType: 'text/plain',
    }),
  });

  if (!metaRes.ok) throw new Error('Failed to create Google Drive file metadata');
  const file = await metaRes.json();

  // Step 2: Upload file media content
  const contentRes = await fetch(`https://www.googleapis.com/upload/drive/v3/files/${file.id}?uploadType=media`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'text/plain',
    },
    body: content,
  });

  if (!contentRes.ok) throw new Error('Failed to upload file content to Google Drive');
  return file;
}

