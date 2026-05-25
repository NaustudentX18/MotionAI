/**
 * PresenceManager — WebRTC-based peer presence for MotionAI.
 *
 * Signaling: BroadcastChannel (same device, same origin) + HTTP polling to
 * the app's Express server (/api/presence/signal) for cross-device peers.
 *
 * Proof of concept only — presence broadcast only, no document sync.
 */

import { v4 as uuidv4 } from 'uuid';

export interface PresencePeer {
  peerId: string;
  userId: string;
  userName: string;
  pageId: string;
  lastSeen: number;
}

export interface PresenceDiagnostics {
  webRtcAvailable: boolean;
  broadcastChannelAvailable: boolean;
  httpSignalUrl: string;
  iceServers: RTCIceServer[];
  activePeerCount: number;
  totalPeerCount: number;
  currentPageId: string;
  startedAt: number | null;
  lastSignalPollAt: number | null;
  lastSignalPostAt: number | null;
  lastError: string | null;
}

export interface PresenceManagerEvents {
  onPeersChange: (peers: PresencePeer[]) => void;
  onError: (msg: string) => void;
  onDiagnosticsChange?: (diagnostics: PresenceDiagnostics) => void;
}

interface PeerConnection {
  pc: RTCPeerConnection;
  dc: RTCDataChannel | null;
  signalChannel: BroadcastChannel | null;
}

interface OutgoingSignal {
  to: string;
  from: string;
  type: 'offer' | 'answer' | 'ice-candidate';
  payload: RTCSessionDescriptionInit | RTCIceCandidateInit;
}

interface IncomingSignal {
  from: string;
  type: 'offer' | 'answer' | 'ice-candidate';
  payload: RTCSessionDescriptionInit | RTCIceCandidateInit;
}

const ICE_SERVERS: RTCIceServer[] = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
];

const SIGNAL_POLL_INTERVAL = 2000;
const PEER_TIMEOUT_MS = 15000;

export class PresenceManager {
  private peerId: string;
  private userId: string;
  private userName: string;
  private currentPageId: string = '';
  private peers: Map<string, PresencePeer> = new Map();
  private peerConnections: Map<string, PeerConnection> = new Map();
  private events: PresenceManagerEvents;
  private localBc: BroadcastChannel | null = null;
  private pollingTimer: ReturnType<typeof setInterval> | null = null;
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private isOpen: boolean = false;
  private userInfo: { userId: string; userName: string };
  private diagnostics: PresenceDiagnostics;

  constructor(userInfo: { userId: string; userName: string }, events: PresenceManagerEvents) {
    this.peerId = uuidv4();
    this.userId = userInfo.userId;
    this.userName = userInfo.userName;
    this.userInfo = userInfo;
    this.events = events;
    this.diagnostics = {
      webRtcAvailable: typeof RTCPeerConnection !== 'undefined',
      broadcastChannelAvailable: typeof BroadcastChannel !== 'undefined',
      httpSignalUrl: typeof window !== 'undefined' ? this.getHttpSignalUrl() : '',
      iceServers: ICE_SERVERS,
      activePeerCount: 0,
      totalPeerCount: 0,
      currentPageId: '',
      startedAt: null,
      lastSignalPollAt: null,
      lastSignalPostAt: null,
      lastError: null,
    };

    // Check for WebRTC support
    if (typeof RTCPeerConnection === 'undefined') {
      this.reportError('WebRTC not available — presence unavailable');
      return;
    }
  }

  private getSignalUrl(): string {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    return `${protocol}//${window.location.host}/api/presence/signal`;
  }

  private getHttpSignalUrl(): string {
    return `${window.location.origin}/api/presence/signal`;
  }

  // ─── BroadcastChannel (same-device) ───────────────────────────────────────

  private initBroadcastChannel() {
    try {
      this.localBc = new BroadcastChannel('motionai-presence');
      this.localBc.onmessage = (ev) => this.handleBcMessage(ev.data);
      this.updateDiagnostics({ broadcastChannelAvailable: true });
      // Announce ourselves to other tabs on the same device
      this.broadcastBc({ type: 'announce', peerId: this.peerId, userId: this.userId, userName: this.userName });
    } catch {
      this.updateDiagnostics({ broadcastChannelAvailable: false });
      // BroadcastChannel not supported — skip
    }
  }

  private broadcastBc(msg: object) {
    this.localBc?.postMessage(msg);
  }

  private handleBcMessage(data: any) {
    if (!data || data.peerId === this.peerId) return;

    switch (data.type) {
      case 'announce':
        // Same-device peer discovered — establish data channel
        if (!this.peerConnections.has(data.peerId)) {
          this.initiateBcPeerConnection(data.peerId, data.userId, data.userName);
        }
        break;
      case 'peer-signal':
        // Forward WebRTC signal from same-device peer
        if (this.peerConnections.has(data.peerId)) {
          this.handleBcPeerSignal(data.peerId, data.signal);
        }
        break;
      case 'presence':
        this.updatePeer(data as PresencePeer);
        break;
      case 'leave':
        this.removePeer(data.peerId);
        break;
    }
  }

  private async initiateBcPeerConnection(remotePeerId: string, remoteUserId: string, remoteUserName: string) {
    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });

    pc.onicecandidate = (ev) => {
      if (ev.candidate) {
        this.broadcastBc({ type: 'peer-signal', peerId: this.peerId, signal: { type: 'ice-candidate', candidate: ev.candidate } });
      }
    };

    pc.ondatachannel = (ev) => {
      this.setupDataChannel(remotePeerId, ev.channel);
    };

    // Create data channel (label must be 'presence')
    const dc = pc.createDataChannel('presence', { ordered: true });
    this.setupDataChannel(remotePeerId, dc);

    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);

    this.peerConnections.set(remotePeerId, { pc, dc, signalChannel: this.localBc });

    this.broadcastBc({
      type: 'peer-signal',
      peerId: this.peerId,
      signal: { type: 'offer', sdp: pc.localDescription },
    });

    this.updatePeer({ peerId: remotePeerId, userId: remoteUserId, userName: remoteUserName, pageId: '', lastSeen: Date.now() });
  }

  private async handleBcPeerSignal(remotePeerId: string, signal: any) {
    let conn = this.peerConnections.get(remotePeerId);
    if (!conn) return;

    if (signal.type === 'offer') {
      const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });

      pc.onicecandidate = (ev) => {
        if (ev.candidate) {
          this.broadcastBc({ type: 'peer-signal', peerId: this.peerId, signal: { type: 'ice-candidate', candidate: ev.candidate } });
        }
      };

      pc.ondatachannel = (ev) => {
        this.setupDataChannel(remotePeerId, ev.channel);
      };

      await pc.setRemoteDescription(new RTCSessionDescription(signal.sdp));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      this.peerConnections.set(remotePeerId, { pc, dc: null, signalChannel: this.localBc });

      this.broadcastBc({
        type: 'peer-signal',
        peerId: this.peerId,
        signal: { type: 'answer', sdp: pc.localDescription },
      });
    } else if (signal.type === 'answer') {
      await conn.pc.setRemoteDescription(new RTCSessionDescription(signal.sdp));
    } else if (signal.type === 'ice-candidate') {
      try {
        await conn.pc.addIceCandidate(new RTCIceCandidate(signal.candidate));
      } catch { /* ignore */ }
    }
  }

  // ─── Data Channel ──────────────────────────────────────────────────────────

  private setupDataChannel(remotePeerId: string, dc: RTCDataChannel) {
    dc.onopen = () => {
      this.sendPresence(remotePeerId);
    };

    dc.onmessage = (ev) => {
      try {
        const data = JSON.parse(ev.data);
        if (data.type === 'presence') {
          this.updatePeer({ ...data, peerId: remotePeerId, lastSeen: Date.now() });
        }
      } catch { /* ignore malformed messages */ }
    };

    dc.onclose = () => {
      const conn = this.peerConnections.get(remotePeerId);
      if (conn) {
        conn.dc = null;
      }
    };

    const conn = this.peerConnections.get(remotePeerId);
    if (conn) {
      conn.dc = dc;
    }
  }

  private sendPresence(remotePeerId: string) {
    const conn = this.peerConnections.get(remotePeerId);
    if (!conn?.dc || conn.dc.readyState !== 'open') return;

    const msg = JSON.stringify({
      type: 'presence',
      peerId: this.peerId,
      userId: this.userId,
      userName: this.userName,
      pageId: this.currentPageId,
    });
    conn.dc.send(msg);
  }

  // ─── Cross-device HTTP signaling ─────────────────────────────────────────

  private async httpSendSignal(signal: OutgoingSignal) {
    try {
      await fetch(this.getHttpSignalUrl(), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(signal),
        signal: AbortSignal.timeout(3000),
      });
      this.updateDiagnostics({ lastSignalPostAt: Date.now(), lastError: null });
    } catch (error) {
      this.reportError(`signal send failed: ${error instanceof Error ? error.message : 'unknown error'}`, false);
    }
  }

  private async httpPollSignals() {
    try {
      const res = await fetch(`${this.getHttpSignalUrl()}?peerId=${encodeURIComponent(this.peerId)}`, {
        signal: AbortSignal.timeout(5000),
      });
      this.updateDiagnostics({ lastSignalPollAt: Date.now() });
      if (!res.ok) {
        this.reportError(`signal poll failed: HTTP ${res.status}`, false);
        return;
      }

      const signals: IncomingSignal[] = await res.json();
      this.updateDiagnostics({ lastError: null });
      for (const signal of signals) {
        await this.handleHttpSignal(signal);
      }
    } catch (error) {
      this.reportError(`signal poll failed: ${error instanceof Error ? error.message : 'unknown error'}`, false);
    }
  }

  private async handleHttpSignal(signal: IncomingSignal) {
    if (!this.peerConnections.has(signal.from)) {
      // New peer — create connection
      const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });

      pc.onicecandidate = (ev) => {
        if (ev.candidate) {
          this.httpSendSignal({
            to: signal.from,
            from: this.peerId,
            type: 'ice-candidate',
            payload: ev.candidate.toJSON(),
          });
        }
      };

      pc.ondatachannel = (ev) => {
        this.setupDataChannel(signal.from, ev.channel);
      };

      const dc = pc.createDataChannel('presence', { ordered: true });
      this.setupDataChannel(signal.from, dc);

      this.peerConnections.set(signal.from, { pc, dc, signalChannel: null });

      if (signal.type === 'offer') {
        await pc.setRemoteDescription(new RTCSessionDescription(signal.payload as RTCSessionDescriptionInit));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        await this.httpSendSignal({
          to: signal.from,
          from: this.peerId,
          type: 'answer',
          payload: pc.localDescription!.toJSON(),
        });
      }
    } else {
      const conn = this.peerConnections.get(signal.from)!;
      if (signal.type === 'answer') {
        await conn.pc.setRemoteDescription(new RTCSessionDescription(signal.payload as RTCSessionDescriptionInit));
      } else if (signal.type === 'ice-candidate') {
        try {
          await conn.pc.addIceCandidate(new RTCIceCandidate(signal.payload as RTCIceCandidateInit));
        } catch { /* ignore */ }
      }
    }
  }

  // ─── Peer state ───────────────────────────────────────────────────────────

  private updatePeer(peer: PresencePeer) {
    peer.lastSeen = Date.now();
    this.peers.set(peer.peerId, peer);
    this.notifyPeersChange();
    this.emitDiagnostics();
  }

  private removePeer(peerId: string) {
    this.peers.delete(peerId);
    const conn = this.peerConnections.get(peerId);
    if (conn) {
      try { conn.dc?.close(); } catch { /* ignore */ }
      try { conn.pc.close(); } catch { /* ignore */ }
      this.peerConnections.delete(peerId);
    }
    this.notifyPeersChange();
    this.emitDiagnostics();
  }

  private updateDiagnostics(partial: Partial<PresenceDiagnostics>) {
    this.diagnostics = { ...this.diagnostics, ...partial };
    this.emitDiagnostics();
  }

  private reportError(msg: string, notify = true) {
    this.updateDiagnostics({ lastError: msg });
    if (notify) this.events.onError(msg);
  }

  private emitDiagnostics() {
    const activePeerCount = this.getActivePeers().length;
    this.diagnostics = {
      ...this.diagnostics,
      webRtcAvailable: this.isWebRtcAvailable(),
      httpSignalUrl: this.getHttpSignalUrl(),
      activePeerCount,
      totalPeerCount: this.peers.size,
      currentPageId: this.currentPageId,
    };
    this.events.onDiagnosticsChange?.({ ...this.diagnostics });
  }

  private notifyPeersChange() {
    const active = Array.from(this.peers.values()).filter(
      (p) => p.pageId === this.currentPageId && Date.now() - p.lastSeen < PEER_TIMEOUT_MS
    );
    this.events.onPeersChange(active);
  }

  private checkPeerTimeouts() {
    const now = Date.now();
    let changed = false;
    for (const [peerId, peer] of this.peers) {
      if (now - peer.lastSeen > PEER_TIMEOUT_MS) {
        this.peers.delete(peerId);
        changed = true;
      }
    }
    if (changed) {
      this.notifyPeersChange();
      this.emitDiagnostics();
    }
  }

  // ─── Public API ───────────────────────────────────────────────────────────

  /**
   * Start presence manager. Announces presence to other tabs/devices viewing the same page.
   */
  start(pageId: string) {
    if (!this.isWebRtcAvailable()) {
      this.events.onError('presence unavailable');
      return;
    }

    this.currentPageId = pageId;
    this.isOpen = true;
    this.updateDiagnostics({ startedAt: Date.now(), currentPageId: pageId, lastError: null });

    this.initBroadcastChannel();
    this.announce(pageId);

    // Poll for cross-device signals
    this.pollingTimer = setInterval(() => this.httpPollSignals(), SIGNAL_POLL_INTERVAL);
    // Prune stale peers
    this.heartbeatTimer = setInterval(() => this.checkPeerTimeouts(), SIGNAL_POLL_INTERVAL);
  }

  /**
   * Update the current page — broadcasts a page-change to all peers.
   */
  updatePage(pageId: string) {
    if (pageId === this.currentPageId) return;
    this.currentPageId = pageId;
    this.updateDiagnostics({ currentPageId: pageId });
    this.broadcastToAll({ type: 'presence', peerId: this.peerId, userId: this.userId, userName: this.userName, pageId });
    this.notifyPeersChange();
  }

  /**
   * Announce presence on a page.
   */
  announce(pageId: string) {
    this.currentPageId = pageId;
    this.updateDiagnostics({ currentPageId: pageId });
    this.broadcastToAll({ type: 'presence', peerId: this.peerId, userId: this.userId, userName: this.userName, pageId });
    this.notifyPeersChange();
  }

  private broadcastToAll(msg: object) {
    const json = JSON.stringify(msg);
    for (const conn of this.peerConnections.values()) {
      try {
        if (conn.dc?.readyState === 'open') conn.dc.send(json);
      } catch { /* ignore */ }
    }
    this.broadcastBc(msg);
  }

  /**
   * Stop and clean up all connections.
   */
  stop() {
    if (!this.isOpen) return;
    this.isOpen = false;

    // Notify peers we're leaving
    const leaveMsg = JSON.stringify({ type: 'leave', peerId: this.peerId, userId: this.userId });
    for (const conn of this.peerConnections.values()) {
      try {
        if (conn.dc?.readyState === 'open') conn.dc.send(leaveMsg);
        conn.dc?.close();
        conn.pc.close();
      } catch { /* ignore */ }
    }

    if (this.pollingTimer) clearInterval(this.pollingTimer);
    if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);
    this.localBc?.close();

    this.peerConnections.clear();
    this.peers.clear();
    this.notifyPeersChange();
    this.updateDiagnostics({ startedAt: null, activePeerCount: 0, totalPeerCount: 0 });
  }

  getPeerId(): string {
    return this.peerId;
  }

  isWebRtcAvailable(): boolean {
    return typeof RTCPeerConnection !== 'undefined';
  }

  getDiagnostics(): PresenceDiagnostics {
    this.emitDiagnostics();
    return { ...this.diagnostics };
  }

  /** Get currently active peers on the same page */
  getActivePeers(): PresencePeer[] {
    return Array.from(this.peers.values()).filter(
      (p) => p.pageId === this.currentPageId && Date.now() - p.lastSeen < PEER_TIMEOUT_MS
    );
  }
}
