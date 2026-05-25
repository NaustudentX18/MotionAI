/**
 * useWebRTCConfig.ts — ICE/STUN server configuration hook.
 *
 * Persists a list of ICE server URLs to localStorage and provides
 * add/remove/test utilities for the WebRTC peer connection.
 */

const STORAGE_KEY = 'motionai-webrtc-ice-config';

export interface StunTurnServer {
  urls: string;
  username?: string;
  credential?: string;
}

const DEFAULT_SERVERS: StunTurnServer[] = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  { urls: 'stun:stun2.l.google.com:19302' },
  { urls: 'stun:stun3.l.google.com:19302' },
  { urls: 'stun:stun4.l.google.com:19302' },
];

function loadRaw(): StunTurnServer[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : DEFAULT_SERVERS;
  } catch {
    return DEFAULT_SERVERS;
  }
}

function save(servers: StunTurnServer[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(servers));
}

export function useWebRTCConfig() {
  const getServers = (): StunTurnServer[] => loadRaw();

  const setServers = (servers: StunTurnServer[]): void => {
    save(servers);
  };

  const addServer = (server: StunTurnServer): void => {
    const current = loadRaw();
    current.push(server);
    save(current);
  };

  const removeServer = (index: number): void => {
    const current = loadRaw();
    current.splice(index, 1);
    save(current);
  };

  const resetToDefaults = (): void => {
    save(DEFAULT_SERVERS);
  };

  /**
   * Attempt a WebRTC connection using the current ICE config.
   * Returns the time taken to find a candidate, or null on failure/timeout.
   */
  const testConnection = async (timeoutMs = 5000): Promise<{ success: boolean; durationMs: number; candidateType?: string }> => {
    const servers = loadRaw();
    const pc = new RTCPeerConnection({
      iceServers: servers.map((s) => ({
        urls: s.urls,
        username: s.username,
        credential: s.credential,
      })),
    });

    const startTime = performance.now();
    try {
      // Create a data channel to trigger ICE gathering
      pc.createDataChannel('test');

      const candidate = await new Promise<{ type: string } | null>((resolve) => {
        const timer = setTimeout(() => {
          resolve(null);
          pc.close();
        }, timeoutMs);

        pc.onicecandidate = (e) => {
          if (e.candidate) {
            clearTimeout(timer);
            resolve({ type: e.candidate.type });
            pc.close();
          }
        };

        // Also resolve if no candidates are generated
        setTimeout(() => {
          clearTimeout(timer);
          resolve(null);
          pc.close();
        }, 2000);
      });

      const durationMs = Math.round(performance.now() - startTime);
      if (candidate) {
        return { success: true, durationMs, candidateType: candidate.type };
      }
      return { success: true, durationMs };
    } catch (err) {
      const durationMs = Math.round(performance.now() - startTime);
      return { success: false, durationMs };
    } finally {
      pc.close();
    }
  };

  return {
    getServers,
    setServers,
    addServer,
    removeServer,
    resetToDefaults,
    testConnection,
    defaultServers: DEFAULT_SERVERS,
  };
}
