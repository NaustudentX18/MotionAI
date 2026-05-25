/**
 * Whiteboard templates for the Canvas editor.
 *
 * The data here is intentionally plain and truthful: it describes local tldraw
 * starter layouts, not generated AI content. CanvasEditor converts each entry
 * into the current tldraw shape schema at render time.
 */
import type { TLDefaultColorStyle, TLGeoShapeGeoStyle } from '@tldraw/tldraw';

export type TemplateId = 'project-kickoff' | 'sprint-map' | 'content-calendar' | 'research-wall';

export type CanvasTemplateShape =
  | {
      type: 'geo';
      x: number;
      y: number;
      w: number;
      h: number;
      text: string;
      color: TLDefaultColorStyle;
      geo?: TLGeoShapeGeoStyle;
    }
  | {
      type: 'note';
      x: number;
      y: number;
      text: string;
      color: TLDefaultColorStyle;
    };

export interface CanvasTemplate {
  id: TemplateId;
  name: string;
  description: string;
  icon: string;
  shapes: CanvasTemplateShape[];
}

export const CANVAS_TEMPLATES: CanvasTemplate[] = [
  {
    id: 'project-kickoff',
    name: 'Project Kickoff',
    description: 'Goals, scope, stakeholders, risks, and milestones.',
    icon: '🚀',
    shapes: [
      { type: 'geo', x: 0, y: 0, w: 280, h: 80, text: '🚀 Project Goal\nDefine the single most important outcome.', color: 'violet' },
      { type: 'geo', x: 320, y: 0, w: 280, h: 80, text: '📋 Scope\nWhat is in and out of scope for v1.', color: 'blue' },
      { type: 'geo', x: 0, y: 120, w: 200, h: 80, text: '👥 Stakeholders\nWho needs to be involved.', color: 'green' },
      { type: 'geo', x: 240, y: 120, w: 200, h: 80, text: '⚠️ Risks\nTop risks and mitigations.', color: 'red' },
      { type: 'geo', x: 480, y: 120, w: 200, h: 80, text: '🏁 Milestones\nKey dates and deliverables.', color: 'orange' },
      { type: 'note', x: 0, y: 240, text: '💡 Notes & open questions', color: 'yellow' },
    ],
  },
  {
    id: 'sprint-map',
    name: 'Sprint Map',
    description: 'Sprint goal, backlog items, in-progress, and done.',
    icon: '🏃',
    shapes: [
      { type: 'geo', x: 0, y: 0, w: 380, h: 60, text: '🎯 Sprint Goal (2 weeks)', color: 'violet' },
      { type: 'geo', x: 420, y: 0, w: 220, h: 60, text: '📊 Velocity target\nPoints / story count', color: 'blue' },
      { type: 'geo', x: 0, y: 100, w: 200, h: 180, text: '📥 Backlog', color: 'grey' },
      { type: 'geo', x: 220, y: 100, w: 200, h: 180, text: '🔧 In Progress\n(WIP limit: 3)', color: 'orange' },
      { type: 'geo', x: 440, y: 100, w: 200, h: 180, text: '✅ Done', color: 'green' },
      { type: 'note', x: 0, y: 320, text: '🚧 Blockers & dependencies', color: 'red' },
      { type: 'note', x: 220, y: 320, text: '🔍 Retro notes', color: 'yellow' },
    ],
  },
  {
    id: 'content-calendar',
    name: 'Content Calendar',
    description: 'Monthly/weekly content pipeline from idea to published.',
    icon: '📅',
    shapes: [
      { type: 'geo', x: 0, y: 0, w: 400, h: 50, text: '📅 Content Calendar — Month View', color: 'violet' },
      { type: 'geo', x: 0, y: 80, w: 130, h: 160, text: '💡 Ideas', color: 'grey' },
      { type: 'geo', x: 150, y: 80, w: 130, h: 160, text: '✍️ Drafting', color: 'blue' },
      { type: 'geo', x: 300, y: 80, w: 130, h: 160, text: '👀 Review', color: 'orange' },
      { type: 'geo', x: 450, y: 80, w: 130, h: 160, text: '🚀 Published', color: 'green' },
      { type: 'geo', x: 0, y: 270, w: 300, h: 60, text: '📊 Metrics to track\nViews, engagement, conversions', color: 'light-violet' },
    ],
  },
  {
    id: 'research-wall',
    name: 'Research Wall',
    description: 'Questions, sources, findings, and conclusions.',
    icon: '🔬',
    shapes: [
      { type: 'geo', x: 0, y: 0, w: 350, h: 60, text: '🔬 Research Question', color: 'violet' },
      { type: 'geo', x: 0, y: 90, w: 200, h: 140, text: '📚 Sources & References', color: 'blue' },
      { type: 'geo', x: 230, y: 90, w: 200, h: 140, text: '🔍 Key Findings', color: 'green' },
      { type: 'geo', x: 460, y: 90, w: 200, h: 140, text: '❓ Open Questions', color: 'orange' },
      { type: 'geo', x: 0, y: 260, w: 380, h: 60, text: '✅ Conclusion / Recommendation', color: 'light-violet' },
      { type: 'note', x: 420, y: 260, text: '📎 Attachments & links', color: 'yellow' },
    ],
  },
];

export function getTemplate(id: TemplateId): CanvasTemplate | undefined {
  return CANVAS_TEMPLATES.find(t => t.id === id);
}
