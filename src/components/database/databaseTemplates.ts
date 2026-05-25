import { Database, DatabaseRow, DatabaseTemplate, DatabaseView } from '../../types/database';

export const DEFAULT_DATABASE_PROPERTY_IDS = {
  title: 'prop-title',
  status: 'prop-status',
  date: 'prop-date',
  notes: 'prop-notes',
} as const;

export function createDefaultDatabase(): Database {
  const now = Date.now();
  const today = new Date().toISOString().split('T')[0];

  return {
    id: crypto.randomUUID(),
    title: 'Tasks Database',
    properties: [
      { id: DEFAULT_DATABASE_PROPERTY_IDS.title, name: 'Name', type: 'text' },
      {
        id: DEFAULT_DATABASE_PROPERTY_IDS.status,
        name: 'Status',
        type: 'select',
        options: [
          { id: 'opt-todo', name: 'To Do', color: 'gray' },
          { id: 'opt-progress', name: 'In Progress', color: 'blue' },
          { id: 'opt-done', name: 'Done', color: 'emerald' },
        ],
      },
      { id: DEFAULT_DATABASE_PROPERTY_IDS.date, name: 'Due Date', type: 'date' },
      { id: DEFAULT_DATABASE_PROPERTY_IDS.notes, name: 'Notes', type: 'text' },
    ],
    rows: [
      {
        id: 'row-1',
        values: {
          [DEFAULT_DATABASE_PROPERTY_IDS.title]: 'Project kickoff meeting',
          [DEFAULT_DATABASE_PROPERTY_IDS.status]: 'To Do',
          [DEFAULT_DATABASE_PROPERTY_IDS.date]: today,
          [DEFAULT_DATABASE_PROPERTY_IDS.notes]: 'Draft agenda and invite stakeholders.',
        },
        createdAt: now,
        updatedAt: now,
      },
    ],
    views: createDefaultViews(),
    activeViewId: 'view-table',
    templates: createDefaultTemplates(today),
  };
}

export function createDefaultViews(): DatabaseView[] {
  const { title, status, date, notes } = DEFAULT_DATABASE_PROPERTY_IDS;
  return [
    { id: 'view-table', name: 'Table', type: 'table', visibleProperties: [title, status, date, notes] },
    { id: 'view-board', name: 'Board', type: 'board', visibleProperties: [title, status, date], groupByPropertyId: status, titlePropertyId: title },
    { id: 'view-calendar', name: 'Calendar', type: 'calendar', visibleProperties: [title, status], datePropertyId: date, titlePropertyId: title },
    { id: 'view-list', name: 'List', type: 'list', visibleProperties: [title, status, date], titlePropertyId: title },
    { id: 'view-gallery', name: 'Gallery', type: 'gallery', visibleProperties: [title, status, date, notes], titlePropertyId: title },
    { id: 'view-timeline', name: 'Timeline', type: 'timeline', visibleProperties: [title, status], timelineStartPropertyId: date, titlePropertyId: title },
  ];
}

export function createDefaultTemplates(today = new Date().toISOString().split('T')[0]): DatabaseTemplate[] {
  const { title, status, date, notes } = DEFAULT_DATABASE_PROPERTY_IDS;
  return [
    {
      id: 'template-task',
      name: 'Task',
      description: 'A single actionable task with status and due date.',
      values: { [title]: 'New task', [status]: 'To Do', [date]: today, [notes]: '' },
    },
    {
      id: 'template-meeting',
      name: 'Meeting notes',
      description: 'A lightweight page/database row for a meeting.',
      values: { [title]: 'New meeting', [status]: 'To Do', [date]: today, [notes]: 'Attendees:\nDecisions:\nNext steps:' },
    },
  ];
}

export function normalizeDatabase(raw: Database): Database {
  const views = mergeDefaultViews(raw.views || [], raw.properties.map(property => property.id));
  const activeViewId = views.some(view => view.id === raw.activeViewId) ? raw.activeViewId : views[0]?.id;

  return {
    ...raw,
    rows: raw.rows || [],
    properties: raw.properties || [],
    views,
    activeViewId,
    templates: raw.templates?.length ? raw.templates : createDefaultTemplates(),
  };
}

export function createRowFromTemplate(template: DatabaseTemplate): DatabaseRow {
  return {
    id: crypto.randomUUID(),
    values: { ...template.values },
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}

function mergeDefaultViews(existingViews: DatabaseView[], propertyIds: string[]): DatabaseView[] {
  const defaultViews = createDefaultViews();
  const knownViews = defaultViews.map(defaultView => {
    const existing = existingViews.find(view => view.type === defaultView.type || view.id === defaultView.id);
    const merged = existing ? { ...defaultView, ...existing } : defaultView;
    return {
      ...merged,
      visibleProperties: sanitizeVisibleProperties(merged.visibleProperties, propertyIds),
      groupByPropertyId: propertyIds.includes(merged.groupByPropertyId || '') ? merged.groupByPropertyId : undefined,
      datePropertyId: propertyIds.includes(merged.datePropertyId || '') ? merged.datePropertyId : undefined,
      titlePropertyId: propertyIds.includes(merged.titlePropertyId || '') ? merged.titlePropertyId : undefined,
      coverPropertyId: propertyIds.includes(merged.coverPropertyId || '') ? merged.coverPropertyId : undefined,
      timelineStartPropertyId: propertyIds.includes(merged.timelineStartPropertyId || '') ? merged.timelineStartPropertyId : undefined,
      timelineEndPropertyId: propertyIds.includes(merged.timelineEndPropertyId || '') ? merged.timelineEndPropertyId : undefined,
    };
  });

  const customViews = existingViews.filter(view => !knownViews.some(known => known.id === view.id));
  return [...knownViews, ...customViews.map(view => ({ ...view, visibleProperties: sanitizeVisibleProperties(view.visibleProperties, propertyIds) }))];
}

function sanitizeVisibleProperties(visibleProperties: string[] | undefined, propertyIds: string[]): string[] {
  const visible = (visibleProperties || []).filter(id => propertyIds.includes(id));
  return visible.length > 0 ? visible : propertyIds;
}
