export type PropertyType =
  | 'text'
  | 'number'
  | 'select'
  | 'multi-select'
  | 'date'
  | 'checkbox'
  | 'relation'
  | 'rollup'
  | 'formula'
  | 'ai';

export interface SelectOption {
  id: string;
  name: string;
  color?: string; // Tailwind color name or hex
}

export interface DatabaseProperty {
  id: string;
  name: string;
  type: PropertyType;
  options?: SelectOption[]; // For select & multi-select
  formula?: string; // JS expression or AI prompt template
  relationDatabaseId?: string; // For relation
  rollupPropertyId?: string; // Property of target database to rollup
  rollupRelationId?: string; // Relation property on this database to use
}

export interface DatabaseRow {
  id: string;
  values: Record<string, any>; // propertyId -> cell value
  createdAt: number;
  updatedAt: number;
}

export type DatabaseViewType = 'table' | 'board' | 'calendar' | 'gallery' | 'list' | 'timeline';

export interface DatabaseView {
  id: string;
  name: string;
  type: DatabaseViewType;
  visibleProperties: string[]; // property IDs
  groupByPropertyId?: string; // for Kanban board
  datePropertyId?: string; // for Calendar view
  titlePropertyId?: string; // for list/gallery/timeline card titles
  coverPropertyId?: string; // for Gallery preview image/url
  timelineStartPropertyId?: string; // for Timeline view
  timelineEndPropertyId?: string; // optional end date for Timeline view
}

export interface DatabaseTemplate {
  id: string;
  name: string;
  description?: string;
  values: Record<string, any>; // propertyId -> default cell value
}

export interface Database {
  id: string;
  title: string;
  properties: DatabaseProperty[];
  rows: DatabaseRow[];
  views: DatabaseView[];
  activeViewId?: string;
  templates?: DatabaseTemplate[];
}
