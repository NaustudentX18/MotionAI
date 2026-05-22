import { Database, DatabaseRow, DatabaseProperty } from '../../types/database';
import { loadSettings } from '../settings';
import { createAiClient } from './providers';

/**
 * Executes a smart AI formula for a database row.
 * Resolves properties mapped via {{Property Name}} placeholders inside the prompt template,
 * sends the compiled prompt to the active AI provider, and returns the response.
 */
export async function runAiFormula(
  database: Database,
  property: DatabaseProperty,
  row: DatabaseRow
): Promise<string> {
  const template = property.formula || '';
  if (!template) return '';

  // Extract placeholders matching {{Property Name}} or {{propertyId}}
  const regex = /\{\{([^}]+)\}\}/g;
  let prompt = template;
  let match;

  // We loop to replace all matches
  while ((match = regex.exec(template)) !== null) {
    const placeholder = match[0];
    const key = match[1].trim();

    // Look up target property by case-insensitive name or ID
    const targetProp = database.properties.find(
      (p) => p.name.toLowerCase() === key.toLowerCase() || p.id === key
    );

    let val = '';
    if (targetProp) {
      const cellValue = row.values[targetProp.id];
      if (cellValue !== undefined && cellValue !== null) {
        if (Array.isArray(cellValue)) {
          val = cellValue.join(', ');
        } else if (typeof cellValue === 'object') {
          val = JSON.stringify(cellValue);
        } else {
          val = String(cellValue);
        }
      }
    }
    // Replace current placeholder instance in prompt
    prompt = prompt.replace(placeholder, val);
  }

  // Load configuration from local app settings
  const settings = loadSettings();
  const activeProvider = settings.activeProvider;
  if (activeProvider === 'disabled') {
    return 'Error: AI is disabled in settings';
  }

  const providerConfig = settings.providers[activeProvider];
  const client = createAiClient({
    provider: activeProvider,
    model: providerConfig.model,
    baseUrl: providerConfig.baseUrl,
    apiKey: providerConfig.apiKey,
  });

  try {
    const result = await client.generateText(prompt);
    return result.trim();
  } catch (error) {
    console.error('AiFormulaEngine error:', error);
    return `Error: ${error instanceof Error ? error.message : String(error)}`;
  }
}
