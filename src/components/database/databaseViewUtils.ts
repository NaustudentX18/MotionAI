import { Database, DatabaseProperty, DatabaseRow, DatabaseView } from '../../types/database';

export function getVisibleProperties(database: Database, view?: DatabaseView): DatabaseProperty[] {
  const ids = view?.visibleProperties?.length ? view.visibleProperties : database.properties.map(property => property.id);
  const visible = ids
    .map(id => database.properties.find(property => property.id === id))
    .filter((property): property is DatabaseProperty => Boolean(property));

  return visible.length > 0 ? visible : database.properties;
}

export function getTitleProperty(database: Database, preferredPropertyId?: string): DatabaseProperty | undefined {
  return (
    database.properties.find(property => property.id === preferredPropertyId && property.type === 'text') ||
    database.properties.find(property => property.type === 'text') ||
    database.properties[0]
  );
}

export function getRowTitle(database: Database, row: DatabaseRow, preferredPropertyId?: string): string {
  const titleProperty = getTitleProperty(database, preferredPropertyId);
  const value = titleProperty ? row.values[titleProperty.id] : undefined;
  return value ? String(value) : 'Untitled Item';
}

export function formatCellValue(value: any): string {
  if (value === undefined || value === null || value === '') return 'Empty';
  if (Array.isArray(value)) return value.length ? value.join(', ') : 'Empty';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  return String(value);
}

export function isValidDateValue(value: any): boolean {
  return Boolean(value) && !Number.isNaN(new Date(value).getTime());
}

export function toDateKey(value: any): string | null {
  if (!isValidDateValue(value)) return null;
  return new Date(value).toISOString().split('T')[0];
}
