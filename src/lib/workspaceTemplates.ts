/**
 * Workspace page templates — pre-populated page sets for common workflows.
 * Used by the sidebar template quick-start and the new workspace wizard.
 */
import { Page, Block } from '../types';

export type WorkspaceTemplateId =
  | 'student-planner'
  | 'agency-crm'
  | 'product-roadmap'
  | 'homelab-ops'
  | 'personal-wiki'
  | 'sprint-board';

export interface WorkspaceTemplate {
  id: WorkspaceTemplateId;
  name: string;
  description: string;
  icon: string;
  pages: Array<{
    title: string;
    icon: string;
    pageType: Page['pageType'];
    blocks: Array<{ type: Block['type']; content: string; checked?: boolean }>;
    children?: Array<{
      title: string;
      icon: string;
      pageType: Page['pageType'];
      blocks: Array<{ type: Block['type']; content: string; checked?: boolean }>;
    }>;
  }>;
}

function bid(): string {
  return crypto.randomUUID();
}

function pid(): string {
  return crypto.randomUUID();
}

export function instantiateTemplate(template: WorkspaceTemplate): Page[] {
  const pages: Page[] = [];
  const now = Date.now();

  function buildPage(
    spec: WorkspaceTemplate['pages'][0],
    parentId: string | null,
  ): Page {
    const id = pid();
    const blocks: Block[] = spec.blocks.map(b => ({
      id: bid(),
      type: b.type,
      content: b.content,
      checked: b.checked,
    }));

    const page: Page = {
      id,
      title: spec.title,
      icon: spec.icon,
      cover: null,
      blocks,
      createdAt: now,
      updatedAt: now,
      pageType: spec.pageType,
      parentId,
    };

    pages.push(page);

    if (spec.children) {
      for (const child of spec.children) {
        buildPage(child, id);
      }
    }

    return page;
  }

  for (const pageSpec of template.pages) {
    buildPage(pageSpec, null);
  }

  return pages;
}

// ─── Student Planner ──────────────────────────────────────────────────────────

const studentPlanner: WorkspaceTemplate = {
  id: 'student-planner',
  name: 'Student Planner',
  description: 'Semester overview, course notes, assignment tracker, and exam prep.',
  icon: '🎓',
  pages: [
    {
      title: 'Semester Overview',
      icon: '📅',
      pageType: 'block',
      blocks: [
        { type: 'h1', content: 'Semester Overview' },
        { type: 'p', content: 'Add your course schedule, key dates, and semester goals here.' },
        { type: 'todo', content: 'Buy textbooks', checked: false },
        { type: 'todo', content: 'Review syllabus for each course', checked: false },
        { type: 'todo', content: 'Set up study schedule', checked: false },
      ],
    },
    {
      title: 'Assignments',
      icon: '📝',
      pageType: 'database',
      blocks: [
        { type: 'h1', content: 'Assignment Tracker' },
        { type: 'p', content: 'Track all assignments, due dates, and submission status.' },
        { type: 'todo', content: 'Math Homework 1 — Due Week 3', checked: false },
        { type: 'todo', content: 'History Essay — Due Week 5', checked: false },
        { type: 'todo', content: 'CS Project Proposal — Due Week 4', checked: false },
      ],
    },
    {
      title: 'Exam Prep',
      icon: '📚',
      pageType: 'block',
      blocks: [
        { type: 'h1', content: 'Exam Preparation' },
        { type: 'p', content: 'Study notes, practice questions, and revision schedule.' },
        { type: 'h2', content: 'Midterms' },
        { type: 'todo', content: 'Review lecture notes', checked: false },
        { type: 'todo', content: 'Complete practice exam', checked: false },
        { type: 'h2', content: 'Finals' },
        { type: 'todo', content: 'Create study guide', checked: false },
      ],
    },
  ],
};

// ─── Agency CRM ───────────────────────────────────────────────────────────────

const agencyCrm: WorkspaceTemplate = {
  id: 'agency-crm',
  name: 'Agency CRM',
  description: 'Client tracker, project pipeline, invoices, and meeting notes.',
  icon: '🏢',
  pages: [
    {
      title: 'Clients',
      icon: '👥',
      pageType: 'database',
      blocks: [
        { type: 'h1', content: 'Client Directory' },
        { type: 'p', content: 'Active clients, contact info, and engagement status.' },
        { type: 'todo', content: 'Acme Corp — Website redesign', checked: false },
        { type: 'todo', content: 'Beta Inc — SEO campaign', checked: false },
      ],
    },
    {
      title: 'Pipeline',
      icon: '📊',
      pageType: 'database',
      blocks: [
        { type: 'h1', content: 'Project Pipeline' },
        { type: 'h2', content: 'Prospecting' },
        { type: 'todo', content: 'Lead: Example Co.', checked: false },
        { type: 'h2', content: 'Active' },
        { type: 'todo', content: 'Acme Corp — Phase 1', checked: false },
        { type: 'h2', content: 'Completed' },
        { type: 'todo', content: 'Startup X — Brand kit', checked: true },
      ],
    },
    {
      title: 'Meeting Notes',
      icon: '🗒️',
      pageType: 'block',
      blocks: [
        { type: 'h1', content: 'Meeting Notes' },
        { type: 'p', content: 'Log client meetings, action items, and follow-ups.' },
        { type: 'h2', content: 'Template' },
        { type: 'p', content: 'Date: [date]  |  Attendees: [names]  |  Agenda: [topic]' },
        { type: 'todo', content: 'Action item 1', checked: false },
        { type: 'todo', content: 'Action item 2', checked: false },
      ],
    },
  ],
};

// ─── Product Roadmap ──────────────────────────────────────────────────────────

const productRoadmap: WorkspaceTemplate = {
  id: 'product-roadmap',
  name: 'Product Roadmap',
  description: 'Vision, strategy, feature backlog, releases, and user feedback.',
  icon: '🗺️',
  pages: [
    {
      title: 'Vision & Strategy',
      icon: '🔭',
      pageType: 'block',
      blocks: [
        { type: 'h1', content: 'Product Vision' },
        { type: 'p', content: 'What problem are we solving? Who are our users? What does success look like?' },
        { type: 'h2', content: 'North Star Metric' },
        { type: 'p', content: 'Define the one metric that best captures your product\'s value.' },
        { type: 'h2', content: 'Strategic Pillars' },
        { type: 'todo', content: 'Pillar 1: [e.g. Performance]', checked: false },
        { type: 'todo', content: 'Pillar 2: [e.g. Collaboration]', checked: false },
        { type: 'todo', content: 'Pillar 3: [e.g. AI Integration]', checked: false },
      ],
    },
    {
      title: 'Feature Backlog',
      icon: '📋',
      pageType: 'database',
      blocks: [
        { type: 'h1', content: 'Feature Backlog' },
        { type: 'p', content: 'Prioritized features with effort and impact estimates.' },
        { type: 'h2', content: 'Now' },
        { type: 'todo', content: '[P0] Critical bug fix', checked: false },
        { type: 'h2', content: 'Next' },
        { type: 'todo', content: '[P1] User onboarding v2', checked: false },
        { type: 'h2', content: 'Later' },
        { type: 'todo', content: '[P2] Dark mode', checked: false },
      ],
    },
    {
      title: 'Releases',
      icon: '🚢',
      pageType: 'block',
      blocks: [
        { type: 'h1', content: 'Release Notes' },
        { type: 'h2', content: 'v1.0 — MVP Launch' },
        { type: 'todo', content: 'Core feature set', checked: true },
        { type: 'todo', content: 'Onboarding flow', checked: true },
        { type: 'todo', content: 'Bug fixes', checked: true },
        { type: 'h2', content: 'v1.1 — Planned' },
        { type: 'todo', content: 'Feature X', checked: false },
      ],
    },
  ],
};

// ─── Homelab Ops ──────────────────────────────────────────────────────────────

const homelabOps: WorkspaceTemplate = {
  id: 'homelab-ops',
  name: 'Homelab Ops',
  description: 'Server inventory, service dashboard, DNS/network map, and maintenance log.',
  icon: '🖥️',
  pages: [
    {
      title: 'Server Inventory',
      icon: '🗄️',
      pageType: 'database',
      blocks: [
        { type: 'h1', content: 'Server Inventory' },
        { type: 'p', content: 'Track all physical and virtual machines in your homelab.' },
        { type: 'todo', content: 'Raspberry Pi 5 — 8GB — Docker host', checked: false },
        { type: 'todo', content: 'NUC — Proxmox — 4 VMs', checked: false },
        { type: 'todo', content: 'NAS — 4×4TB RAID5', checked: false },
      ],
    },
    {
      title: 'Services',
      icon: '🔌',
      pageType: 'database',
      blocks: [
        { type: 'h1', content: 'Service Dashboard' },
        { type: 'p', content: 'Running services, ports, and health status.' },
        { type: 'todo', content: 'Nginx Proxy Manager — :443', checked: false },
        { type: 'todo', content: 'Pi-hole — :53 DNS', checked: false },
        { type: 'todo', content: 'Home Assistant — :8123', checked: false },
        { type: 'todo', content: 'Plex — :32400', checked: false },
      ],
    },
    {
      title: 'Network Map',
      icon: '🌐',
      pageType: 'canvas',
      blocks: [
        { type: 'h1', content: 'Network Topology' },
        { type: 'p', content: 'Use this canvas to map your network: draw devices, VLANs, and connections.' },
        { type: 'p', content: 'Tip: Embed server cards from the Server Inventory onto this canvas.' },
      ],
    },
    {
      title: 'Maintenance Log',
      icon: '🔧',
      pageType: 'block',
      blocks: [
        { type: 'h1', content: 'Maintenance Log' },
        { type: 'p', content: 'Record updates, incidents, and planned maintenance.' },
        { type: 'h2', content: 'Recurring Tasks' },
        { type: 'todo', content: 'Run apt update && apt upgrade — weekly', checked: false },
        { type: 'todo', content: 'Check disk usage — weekly', checked: false },
        { type: 'todo', content: 'Verify backups — monthly', checked: false },
      ],
    },
  ],
};

// ─── Personal Wiki ────────────────────────────────────────────────────────────

const personalWiki: WorkspaceTemplate = {
  id: 'personal-wiki',
  name: 'Personal Wiki',
  description: 'Knowledge base, daily journal, reading list, and goal tracking.',
  icon: '🧠',
  pages: [
    {
      title: 'Knowledge Base',
      icon: '📖',
      pageType: 'block',
      blocks: [
        { type: 'h1', content: 'Knowledge Base' },
        { type: 'p', content: 'A living document of things you learn and want to remember.' },
        { type: 'h2', content: 'Programming' },
        { type: 'p', content: 'Notes on languages, frameworks, patterns.' },
        { type: 'h2', content: 'DevOps' },
        { type: 'p', content: 'Docker, K8s, CI/CD, monitoring.' },
        { type: 'h2', content: 'Design' },
        { type: 'p', content: 'UI/UX, typography, color theory.' },
      ],
    },
    {
      title: 'Daily Journal',
      icon: '📓',
      pageType: 'block',
      blocks: [
        { type: 'h1', content: 'Daily Journal' },
        { type: 'p', content: 'Today\'s focus, wins, lessons, and gratitude.' },
        { type: 'h2', content: 'Morning' },
        { type: 'todo', content: 'Top 3 priorities for today', checked: false },
        { type: 'h2', content: 'Evening' },
        { type: 'todo', content: 'What went well today?', checked: false },
        { type: 'todo', content: 'What could be improved?', checked: false },
      ],
    },
    {
      title: 'Reading List',
      icon: '📚',
      pageType: 'database',
      blocks: [
        { type: 'h1', content: 'Reading List' },
        { type: 'p', content: 'Books, articles, and papers to read.' },
        { type: 'todo', content: 'Currently reading: [title]', checked: false },
        { type: 'todo', content: 'Up next: [title]', checked: false },
      ],
    },
  ],
};

// ─── Sprint Board ─────────────────────────────────────────────────────────────

const sprintBoard: WorkspaceTemplate = {
  id: 'sprint-board',
  name: 'Sprint Board',
  description: 'Sprint planning, daily standups, retrospectives, and velocity tracking.',
  icon: '🏃',
  pages: [
    {
      title: 'Sprint Backlog',
      icon: '📥',
      pageType: 'database',
      blocks: [
        { type: 'h1', content: 'Sprint Backlog' },
        { type: 'p', content: 'Current sprint items with story points and status.' },
        { type: 'h2', content: 'To Do' },
        { type: 'todo', content: '[3pt] Add user auth flow', checked: false },
        { type: 'todo', content: '[5pt] API rate limiting', checked: false },
        { type: 'h2', content: 'In Progress' },
        { type: 'todo', content: '[2pt] Fix login redirect', checked: false },
        { type: 'h2', content: 'Done' },
        { type: 'todo', content: '[1pt] Update README', checked: true },
      ],
    },
    {
      title: 'Daily Standup',
      icon: '☀️',
      pageType: 'block',
      blocks: [
        { type: 'h1', content: 'Daily Standup Notes' },
        { type: 'p', content: 'Template for daily standup updates.' },
        { type: 'h2', content: 'Yesterday' },
        { type: 'p', content: 'What did you accomplish?' },
        { type: 'h2', content: 'Today' },
        { type: 'p', content: 'What are you working on?' },
        { type: 'h2', content: 'Blockers' },
        { type: 'p', content: 'Anything blocking progress?' },
      ],
    },
    {
      title: 'Retrospective',
      icon: '🔍',
      pageType: 'block',
      blocks: [
        { type: 'h1', content: 'Sprint Retrospective' },
        { type: 'p', content: 'End-of-sprint reflection.' },
        { type: 'h2', content: 'What went well? 🟢' },
        { type: 'p', content: 'Celebrate wins and effective practices.' },
        { type: 'h2', content: 'What could improve? 🟡' },
        { type: 'p', content: 'Areas for growth, process tweaks.' },
        { type: 'h2', content: 'Action items 🔴' },
        { type: 'todo', content: 'Try pair programming on complex stories', checked: false },
      ],
    },
  ],
};

// ─── Registry ─────────────────────────────────────────────────────────────────

export const WORKSPACE_TEMPLATES: WorkspaceTemplate[] = [
  studentPlanner,
  agencyCrm,
  productRoadmap,
  homelabOps,
  personalWiki,
  sprintBoard,
];

export function getWorkspaceTemplate(id: WorkspaceTemplateId): WorkspaceTemplate | undefined {
  return WORKSPACE_TEMPLATES.find(t => t.id === id);
}
