import React, { useState } from 'react';
import { Page, PageVersion } from '../types';
import { History, RotateCcw, Users, Link2 } from 'lucide-react';
import { BacklinksPanel } from './BacklinksPanel';

function stringToColor(str: string): string {
  const PALETTE = ['#8B5CF6', '#10B981', '#F59E0B', '#EF4444', '#3B82F6', '#EC4899', '#14B8A6', '#F97316'];
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  return PALETTE[Math.abs(hash) % PALETTE.length];
}

interface PageAddonsProps {
  currentPage: Page | null;
  onRestoreVersion: (version: PageVersion) => void;
  onSaveSnapshot: () => void;
  // Collaboration / Peer editors
  collaborationActive: boolean;
  onToggleCollaboration: (active: boolean) => void;
  presencePeers: Array<{ peerId: string; userId: string; userName: string; pageId: string; lastSeen: number }>;
  // Backlinks
  pages: Page[];
  backlinks: string[];
  onNavigateToPage: (pageId: string) => void;
}

export function PageAddons({
  currentPage,
  onRestoreVersion,
  onSaveSnapshot,
  collaborationActive,
  onToggleCollaboration,
  presencePeers,
  pages,
  backlinks,
  onNavigateToPage
}: PageAddonsProps) {
  const [activeTab, setActiveTab] = useState<'history' | 'collab' | 'links'>('history');

  if (!currentPage) return null;

  const versions = currentPage.versions || [];

  return (
    <div className="w-full h-full border-l border-[#EBEBE9] dark:border-[#2F2F2F] bg-[#FBFBFA] dark:bg-[#1C1C1C] flex flex-col overflow-y-auto">
      {/* Tabs list */}
      <div className="flex border-b border-[#EBEBE9] dark:border-[#2F2F2F] shrink-0">
        <button
          onClick={() => setActiveTab('history')}
          className={`flex-1 py-3 text-xs font-semibold flex items-center justify-center gap-1.5 border-b-2 transition-all ${
            activeTab === 'history'
              ? 'border-purple-600 text-purple-600 dark:text-purple-400 font-bold'
              : 'border-transparent text-gray-500 hover:text-gray-800 dark:hover:text-gray-200'
          }`}
        >
          <History size={14} />
          Version History
        </button>
        <button
          onClick={() => setActiveTab('collab')}
          className={`flex-1 py-3 text-xs font-semibold flex items-center justify-center gap-1.5 border-b-2 transition-all ${
            activeTab === 'collab'
              ? 'border-purple-600 text-purple-600 dark:text-purple-400 font-bold'
              : 'border-transparent text-gray-500 hover:text-gray-800 dark:hover:text-gray-200'
          }`}
        >
          <Users size={14} />
          Peers & Sync {collaborationActive && <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-ping" />}
        </button>
        <button
          onClick={() => setActiveTab('links')}
          className={`flex-1 py-3 text-xs font-semibold flex items-center justify-center gap-1.5 border-b-2 transition-all ${
            activeTab === 'links'
              ? 'border-purple-600 text-purple-600 dark:text-purple-400 font-bold'
              : 'border-transparent text-gray-500 hover:text-gray-800 dark:hover:text-gray-200'
          }`}
        >
          <Link2 size={14} />
          Links
        </button>
      </div>

      <div className="p-4 flex-1 flex flex-col overflow-y-auto">
        {activeTab === 'history' && (
          <div className="space-y-4 flex flex-col h-full">
            <div className="flex items-center justify-between">
              <span className="text-[10px] uppercase tracking-wider font-bold text-gray-500">Document snapshots</span>
              <button
                onClick={onSaveSnapshot}
                className="text-[11px] bg-purple-50 dark:bg-purple-950/20 text-purple-600 dark:text-purple-400 px-2 py-1 rounded hover:bg-purple-100/50 transition-colors font-medium border border-purple-200/50"
              >
                Save Version
              </button>
            </div>

            {versions.length === 0 ? (
              <div className="text-center py-8 text-xs text-gray-400 italic">
                No saved versions yet. Use the button above to manually save a snapshot, or let auto-sync write backups.
              </div>
            ) : (
              <div className="space-y-2.5 overflow-y-auto pr-1">
                {versions.map((ver, idx) => {
                  const dateStr = new Date(ver.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
                  const dateFull = new Date(ver.timestamp).toLocaleDateString([], { month: 'short', day: 'numeric' });
                  return (
                    <div
                      key={ver.id}
                      className="p-3 border border-[#EBEBE9] dark:border-[#2F2F2F] rounded-lg bg-white dark:bg-[#252525] hover:shadow-xs transition-shadow relative group"
                    >
                      <div className="text-xs font-semibold text-[#37352F] dark:text-[#E3E3E3]">
                        {ver.title || 'Untitled Snapshot'}
                      </div>
                      <div className="text-[10px] text-gray-400 mt-1">
                        {dateFull} at {dateStr}
                      </div>
                      <div className="text-[10px] text-gray-500 mt-1 dark:text-gray-400">
                        {ver.blocks.length} blocks
                      </div>
                      <button
                        onClick={() => onRestoreVersion(ver)}
                        className="absolute right-2.5 top-2.5 p-1 text-purple-600 hover:bg-purple-50 dark:hover:bg-purple-950/30 rounded flex items-center gap-1 text-[11px] font-medium transition-colors opacity-0 group-hover:opacity-100"
                        title="Revert document state to this version"
                      >
                        <RotateCcw size={12} /> Revert
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {activeTab === 'collab' && (
          <div className="space-y-4 flex flex-col h-full">
            <div className="flex items-center justify-between">
              <span className="text-[10px] uppercase tracking-wider font-bold text-gray-500">Sync Status</span>
              <button
                onClick={() => onToggleCollaboration(!collaborationActive)}
                className={`text-[11px] px-2 py-1 rounded transition-colors font-medium border ${
                  collaborationActive
                    ? 'bg-green-50 border-green-200 text-green-700'
                    : 'bg-gray-100 border-gray-200 text-gray-600'
                }`}
              >
                {collaborationActive ? '● Connected' : '○ Offline'}
              </button>
            </div>

            <div className="p-3 bg-blue-50/50 dark:bg-blue-950/10 border border-blue-100 dark:border-blue-950/20 rounded-lg text-xs leading-relaxed text-blue-700 dark:text-blue-400">
              {collaborationActive ? (
                <span>🛜 <strong>Active connection</strong>. Your workspace is synced with peers via WebRTC.</span>
              ) : (
                <span>Offline local mode. Enable sync to engage collaborative editing with peers concurrently on this Workspace board.</span>
              )}
            </div>

            <div className="space-y-3 pt-2">
              <span className="text-[10px] uppercase tracking-wider font-bold text-gray-500 block">
                {presencePeers.length > 0 ? `Connected Peers (${presencePeers.length})` : 'No Peers Connected'}
              </span>

              {presencePeers.length === 0 && (
                <div className="text-center py-4 text-xs text-gray-400 italic">
                  No other devices are currently connected to this workspace.
                </div>
              )}

              {presencePeers.map((peer) => {
                const isRecent = Date.now() - peer.lastSeen < 30000;
                const peerColor = stringToColor(peer.peerId);
                return (
                  <div
                    key={peer.peerId}
                    className="p-3 border border-[#EBEBE9] dark:border-[#2F2F2F] rounded-lg bg-white dark:bg-[#252525] flex items-center justify-between group"
                  >
                    <div className="flex items-center gap-2.5">
                      <div
                        className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold text-white uppercase shrink-0"
                        style={{ backgroundColor: peerColor }}
                      >
                        {peer.userName[0]}
                      </div>
                      <div>
                        <div className="text-xs font-semibold text-[#37352f] dark:text-gray-200">{peer.userName}</div>
                        <div className="text-[9px] text-gray-400">
                          {isRecent ? '✍️ Active now' : '🛋️ Idle'}
                        </div>
                      </div>
                    </div>
                    {isRecent && (
                      <span className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse" />
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {activeTab === 'links' && (
          <div className="pt-2">
            <BacklinksPanel
              currentPage={currentPage}
              pages={pages}
              backlinks={backlinks}
              onNavigateToPage={onNavigateToPage}
            />
          </div>
        )}
      </div>
    </div>
  );
}
