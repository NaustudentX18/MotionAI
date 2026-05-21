import React from 'react';
import { Users } from 'lucide-react';
import type { PresencePeer } from '../lib/presence';

interface PresenceIndicatorProps {
  peers: PresencePeer[];
  available: boolean;
}

export function PresenceIndicator({ peers, available }: PresenceIndicatorProps) {
  if (!available) {
    return (
      <div className="flex items-center gap-1.5 text-[10px] text-gray-400 italic">
        <span className="w-1.5 h-1.5 bg-gray-300 rounded-full" />
        <span>presence unavailable</span>
      </div>
    );
  }

  if (peers.length === 0) {
    return (
      <div className="flex items-center gap-1.5 text-[10px] text-gray-400">
        <span className="w-1.5 h-1.5 bg-gray-300 rounded-full" />
        <Users size={12} />
        <span>only you</span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1.5">
      <div className="flex -space-x-1.5">
        {peers.slice(0, 5).map((peer) => (
          <div
            key={peer.peerId}
            title={`${peer.userName} — viewing same page`}
            className="w-5 h-5 rounded-full bg-green-500 border-2 border-white dark:border-[#1C1C1C] flex items-center justify-center text-[9px] font-bold text-white uppercase shadow-sm"
          >
            {peer.userName[0]}
          </div>
        ))}
        {peers.length > 5 && (
          <div className="w-5 h-5 rounded-full bg-gray-400 border-2 border-white dark:border-[#1C1C1C] flex items-center justify-center text-[9px] font-bold text-white shadow-sm">
            +{peers.length - 5}
          </div>
        )}
      </div>
      <span className="text-[10px] text-gray-500 dark:text-gray-400">
        {peers.length} {peers.length === 1 ? 'peer' : 'peers'} on page
      </span>
    </div>
  );
}
