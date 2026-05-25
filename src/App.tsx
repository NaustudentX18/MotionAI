/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useRef, useMemo } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { Page, Block, PageType } from './types';
import { Sidebar } from './components/Sidebar';
import { BlockEditor } from './components/BlockEditor';
import { CanvasEditor } from './components/CanvasEditor';
import { DatabaseBlock } from './components/blocks/DatabaseBlock';
import { runAiFormula } from './lib/ai/AiFormulaEngine';
import { CommandPalette } from './components/CommandPalette';
import { DriveModal } from './components/DriveModal';
import { TasksModal } from './components/TasksModal';
import { PageAddons } from './components/PageAddons';
import { SpaceFolderPicker } from './components/SpaceFolderPicker';
import { WorkspaceTemplate, instantiateTemplate } from './lib/workspaceTemplates';
import { useSyncStatus, setLastSaveNow } from './hooks/useSyncStatus';
import { MobileWorkspaceApp } from './components/MobileWorkspaceApp';
import { MotionAIHub } from './components/MotionAIHub';
import { SettingsModal } from './components/SettingsModal';
import { TaskPropertiesPanel } from './components/tasks/TaskPropertiesPanel';
import { DashboardWidget } from './components/dashboard/DashboardWidget';
import { SettingsProvider } from './hooks/useSettings';
import { initAuth, googleSignIn, logout } from './lib/firebase';
import { User } from 'firebase/auth';
import { Menu, History, Download, Smartphone, Laptop, Sparkles, CheckSquare, Settings as SettingsIcon, Lock } from 'lucide-react';
import { cn } from './lib/utils';
import { loadWorkspace, saveWorkspace, isWorkspaceLocked, setWorkspaceKey, clearWorkspaceKey, savePage, deletePage as deletePageFromStore, addPage as addPageToStore, setCurrentPageId as setCurrentPageIdInStore, reloadWorkspaceFromLegacyStore, listWorkspaces, createWorkspace, deleteWorkspace, renameWorkspace, updateLastOpened, getDefaultWorkspace, WorkspaceMeta } from './lib/persistence';
import { getYDoc, yDocToSnapshot, destroyYjs } from './lib/yjs';
import { loadSettings } from './lib/settings';
import { backlinksIndex } from './lib/backlinksIndex';
import { PresenceManager } from './lib/presence';
import { PresenceIndicator } from './components/PresenceIndicator';
import { keychain } from './lib/keychain';

function createDefaultPage(): Page {
  return {
    id: uuidv4(),
    title: 'Getting Started',
    icon: '👋',
    cover: null,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    blocks: [
      { id: uuidv4(), type: 'h1', content: 'Welcome to your Workspace ✨' },
      { id: uuidv4(), type: 'p', content: 'This is an exact replica of the core features you love.' },
      { id: uuidv4(), type: 'p', content: 'Type / for commands, or select text to invoke the AI assistant.' },
      { id: uuidv4(), type: 'todo', content: 'Explore slash commands', checked: false },
      { id: uuidv4(), type: 'todo', content: 'Extract text to Google Tasks', checked: false }
    ]
  };
}

export default function App() {
  const [pages, setPages] = useState<Page[]>([]);
  const [currentPageId, setCurrentPageId] = useState<string | null>(null);
  const [workspaceLoaded, setWorkspaceLoaded] = useState(false);
  const [workspaceLocked, setWorkspaceLocked] = useState(false);
  const [passphraseInput, setPassphraseInput] = useState('');
  const [passphraseError, setPassphraseError] = useState('');
  // Workspace state
  const [workspaces, setWorkspaces] = useState<WorkspaceMeta[]>([]);
  const [currentWorkspace, setCurrentWorkspace] = useState<WorkspaceMeta | null>(null);

  // E2EE keychain state
  const [savedKeyAvailable, setSavedKeyAvailable] = useState(false);
  const [showSaveKeyPrompt, setShowSaveKeyPrompt] = useState(false);

  useEffect(() => {
    let cancelled = false;

    // Load workspace list and get default workspace
    const workspaceList = listWorkspaces();
    const defaultWs = getDefaultWorkspace();
    setWorkspaces(workspaceList);
    setCurrentWorkspace(defaultWs);
    updateLastOpened(defaultWs.id);

    // Check if a key is saved in the keychain for this workspace
    keychain.retrieveKey(defaultWs.id).then(savedKey => {
      if (!cancelled) setSavedKeyAvailable(savedKey !== null);
    }).catch(() => {
      if (!cancelled) setSavedKeyAvailable(false);
    });

    loadWorkspace(defaultWs.id)
      .then(snapshot => {
        if (cancelled) return;

        if (snapshot) {
          setPages(snapshot.pages);
          const currentPageExists = snapshot.pages.some(page => page.id === snapshot.currentPageId);
          setCurrentPageId(currentPageExists ? snapshot.currentPageId : snapshot.pages[0]?.id ?? null);
          backlinksIndex.rebuildFromPages(snapshot.pages).catch(err => console.warn('Backlinks index init failed', err));

          // M2: Key was set but Y.Doc came back empty — decryption failed silently.
          // Re-lock and prompt for correct passphrase.
          if (snapshot.pages.length === 0 && !isWorkspaceLocked()) {
            setWorkspaceLocked(true);
            setPassphraseError('Incorrect passphrase');
          }
          return;
        }

        const defaultPage = createDefaultPage();
        setPages([defaultPage]);
        setCurrentPageId(defaultPage.id);
      })
      .catch(error => {
        console.error('Failed to load workspace', error);
        if (!cancelled) {
          const defaultPage = createDefaultPage();
          setPages([defaultPage]);
          setCurrentPageId(defaultPage.id);
        }
      })
      .finally(() => {
        if (!cancelled) setWorkspaceLoaded(true);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  // y-webrtc: real-time cross-device CRDT sync
  useEffect(() => {
    if (!workspaceLoaded) return;

    let rtcProvider: import('y-webrtc').WebrtcProvider | null = null;

    import('y-webrtc').then(({ WebrtcProvider }) => {
      // Signaling servers — first one is self-hosted (local), rest are fallbacks.
      // y-webrtc tries them in order and automatically fails over if one is unreachable.
      const signalingList = (
        import.meta.env.VITE_SIGNALING_URLS ||
        import.meta.env.VITE_SIGNALING_URL ||
        'ws://localhost:3005'
      ).split(',').map((s: string) => s.trim()).filter(Boolean);

      rtcProvider = new WebrtcProvider('motionai-workspace-v1', getYDoc(), {
        signaling: signalingList,
      });
    }).catch(err => {
      console.warn('[y-webrtc] Failed to initialize:', err);
    });

    return () => {
      rtcProvider?.destroy();
    };
  }, [workspaceLoaded]);

  // Y.Doc observer: sync remote changes (cross-tab / y-webrtc) back to React state
  useEffect(() => {
    if (!workspaceLoaded) return;

    const doc = getYDoc();
    const pagesMap = doc.getMap('pages');

    const observer = () => {
      const snapshot = yDocToSnapshot(doc);
      setPages(snapshot.pages);
      const exists = snapshot.pages.some(p => p.id === snapshot.currentPageId);
      setCurrentPageId(exists ? snapshot.currentPageId : snapshot.pages[0]?.id ?? null);
    };

    doc.on('update', observer);
    return () => {
      doc.off('update', observer);
    };
  }, [workspaceLoaded]);

  useEffect(() => {
    if (!workspaceLoaded) return;
    if (currentPageId && !pages.some(page => page.id === currentPageId)) {
      setCurrentPageId(pages[0]?.id ?? null);
    }
  }, [pages, currentPageId, workspaceLoaded]);

  // B0.7: Save and restore page scroll positions
  useEffect(() => {
    if (!workspaceLoaded || !currentPageId) return;

    const prevPageId = prevPageIdRef.current;

    // Save scroll position of the previous page
    if (prevPageId && scrollContainerRef.current) {
      const scrollTop = scrollContainerRef.current.scrollTop;
      setScrollPositions(prev => ({
        ...prev,
        [prevPageId]: scrollTop
      }));
    }

    // Restore scroll position of the current page
    if (currentPageId && scrollContainerRef.current) {
      const savedScrollTop = scrollPositions[currentPageId] || 0;
      // Use setTimeout to ensure the DOM has rendered before restoring scroll
      setTimeout(() => {
        if (scrollContainerRef.current) {
          scrollContainerRef.current.scrollTop = savedScrollTop;
        }
      }, 0);
    }

    // Update the previous page ID ref
    prevPageIdRef.current = currentPageId;
  }, [currentPageId, workspaceLoaded]);

  const [user, setUser] = useState<User | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [driveModalOpen, setDriveModalOpen] = useState(false);
  const [tasksModalOpen, setTasksModalOpen] = useState(false);
  const [settingsModalOpen, setSettingsModalOpen] = useState(false);
  const [viewMode, setViewMode] = useState<'desktop' | 'mobile' | 'hub'>('hub');
  const [activeBlockId, setActiveBlockId] = useState<string | null>(null);
  const [focusAfterInsert, setFocusAfterInsert] = useState<string | null>(null);
  const [scrollPositions, setScrollPositions] = useState<Record<string, number>>({});
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const prevPageIdRef = useRef<string | null>(null);
  // Persisted Dark Mode State & Effect
  const [darkMode, setDarkMode] = useState<boolean>(() => {
    const saved = localStorage.getItem('motion_ai_dark_mode');
    if (saved !== null) {
      return saved === 'true';
    }
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  });

  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    localStorage.setItem('motion_ai_dark_mode', String(darkMode));
  }, [darkMode]);

  // Reduced motion preference
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    const handleChange = (e: MediaQueryListEvent | MediaQueryList) => {
      if (e.matches) {
        document.documentElement.classList.add('reduced-motion');
      } else {
        document.documentElement.classList.remove('reduced-motion');
      }
    };
    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  // Mobile device auto-detection to set default viewMode
  useEffect(() => {
    const isMobileDevice = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || window.innerWidth < 768;
    if (isMobileDevice) {
      setViewMode('mobile');
    }
  }, []);

  // AI Provider Status
  const aiProviderStatus = useMemo(() => {
    const settings = loadSettings();
    const activeProvider = settings.providers[settings.activeProvider];
    if (!activeProvider || !activeProvider.enabled || !activeProvider.baseUrl || !activeProvider.model) {
      return { color: 'red', label: 'No AI configured', provider: null };
    }
    const isExternal = settings.activeProvider === 'gemini' || settings.activeProvider === 'openai-compatible';
    if (isExternal && activeProvider.apiKey) {
      return { color: 'green', label: `${settings.activeProvider} / ${activeProvider.model}`, provider: settings.activeProvider };
    }
    return { color: 'yellow', label: `${settings.activeProvider} / ${activeProvider.model}`, provider: settings.activeProvider };
  }, []);

  // New States: Versions, Sidebar Addons and Collaborators
  const [addonsOpen, setAddonsOpen] = useState(false);
  const [collaborationActive, setCollaborationActive] = useState(true);

  // WebRTC presence state
  const [presencePeers, setPresencePeers] = useState<Array<{ peerId: string; userId: string; userName: string; pageId: string; lastSeen: number }>>([]);
  const syncStatus = useSyncStatus();
  const [movePageId, setMovePageId] = useState<string | null>(null);
  const [presenceAvailable, setPresenceAvailable] = useState(false);
  const presenceManagerRef = useRef<PresenceManager | null>(null);

  // Initialize Auth
  useEffect(() => {
    const unsubscribe = initAuth(
      (u) => setUser(u),
      () => setUser(null)
    );
    return () => unsubscribe();
  }, []);

  const [vectorSearchReady, setVectorSearchReady] = useState(false);

  // Initialize Vector Search only when Command Palette opens (lazy load WASM)
  useEffect(() => {
    if (!paletteOpen) return;
    if (pages.length === 0 || vectorSearchReady) return;

    import('./lib/vectorStore').then(({ initVectorDB }) => {
      initVectorDB(pages)
        .then(() => {
          setVectorSearchReady(true);
        })
        .catch(err => console.error("Vector DB init err:", err));
    });
  }, [paletteOpen, pages, vectorSearchReady]);

  // WebRTC presence: start PresenceManager when page is loaded
  useEffect(() => {
    if (!workspaceLoaded || !currentPageId) return;

    const userId = user?.uid || 'local-user';
    const userName = user?.displayName || user?.email || 'Anonymous';

    const manager = new PresenceManager(
      { userId, userName },
      {
        onPeersChange: (peers) => setPresencePeers(peers),
        onError: (msg) => {
          console.warn('[Presence]', msg);
          setPresenceAvailable(false);
        },
      }
    );

    presenceManagerRef.current = manager;
    setPresenceAvailable(manager.isWebRtcAvailable());
    manager.start(currentPageId);

    return () => {
      manager.stop();
      presenceManagerRef.current = null;
    };
  }, [workspaceLoaded, currentPageId, user]);

  // Update presence when page changes (without re-creating the manager)
  useEffect(() => {
    if (!presenceManagerRef.current || !currentPageId) return;
    presenceManagerRef.current.updatePage(currentPageId);
  }, [currentPageId]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Handle Ctrl+K or Cmd+K
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setPaletteOpen(topLevel => !topLevel);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Listen for open-settings event from BlockEditor error handling
  useEffect(() => {
    const handleOpenSettings = (_e: Event) => {
      setSettingsModalOpen(true);
    };
    window.addEventListener('open-settings', handleOpenSettings);
    return () => window.removeEventListener('open-settings', handleOpenSettings);
  }, []);

  const handleLogin = async () => {
    try {
      await googleSignIn();
    } catch (e) {
      console.error(e);
    }
  };

  const addPage = (pageType: PageType = 'block', parentId: string | null = null) => {
    const newPage: Page = {
      id: uuidv4(),
      title: pageType === 'canvas' ? 'Untitled Canvas' : pageType === 'database' ? 'Untitled Database' : '',
      icon: pageType === 'canvas' ? '🎨' : pageType === 'database' ? '📊' : null,
      cover: null,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      blocks: pageType === 'canvas' ? [] : pageType === 'database' ? [{ id: uuidv4(), type: 'database', content: '' }] : [{ id: uuidv4(), type: 'p', content: '' }],
      pageType,
      parentId,
    };
    // Update React state and Y.Doc
    setPages([...pages, newPage]);
    addPageToStore(newPage);
    setCurrentPageIdInStore(newPage.id);
    setCurrentPageId(newPage.id);
    if (viewMode === 'hub') {
      setViewMode('desktop');
    }
  };

  const updateCurrentPage = (updates: Partial<Page>) => {
    const updated = pages.map(p => p.id === currentPageId ? { ...p, ...updates, updatedAt: Date.now() } : p);
    setPages(updated);
    const changedPage = updated.find(p => p.id === currentPageId);
    if (changedPage) savePage(changedPage);
  };

  const updatePageById = (id: string, updates: Partial<Page>) => {
    const updated = pages.map(p => p.id === id ? { ...p, ...updates, updatedAt: Date.now() } : p);
    setPages(updated);
    const changedPage = updated.find(p => p.id === id);
    if (changedPage) savePage(changedPage);
  };

  const deletePageById = (id: string) => {
    const getDescendants = (parentId: string): string[] => {
      const children = pages.filter(p => p.parentId === parentId);
      return children.reduce<string[]>((acc, child) => {
        return [...acc, child.id, ...getDescendants(child.id)];
      }, []);
    };
    const toDelete = [id, ...getDescendants(id)];

    const updated = pages.filter(p => !toDelete.includes(p.id));
    setPages(updated);
    
    toDelete.forEach(pageId => {
      deletePageFromStore(pageId);
    });

    if (toDelete.includes(currentPageId || '')) {
      const nextId = updated.length > 0 ? updated[0].id : null;
      setCurrentPageId(nextId);
      setCurrentPageIdInStore(nextId);
    }
  };

  const handleAddNewPageObj = (newPage: Page) => {
    setPages([...pages, newPage]);
    addPageToStore(newPage);
    setCurrentPageId(newPage.id);
    setCurrentPageIdInStore(newPage.id);
  };

  const handleImportDrivePage = (title: string, blocks: Block[]) => {
    const newPage: Page = {
      id: uuidv4(),
      title,
      icon: '📁',
      cover: null,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      blocks,
    };
    setPages([...pages, newPage]);
    addPageToStore(newPage);
    setCurrentPageId(newPage.id);
    setCurrentPageIdInStore(newPage.id);
  };

  // Workspace management handlers
  const handleSwitchWorkspace = async (workspace: WorkspaceMeta) => {
    // Save current workspace state before switching
    if (workspaceLoaded && pages.length > 0) {
      const snapshot = yDocToSnapshot(getYDoc());
      await saveWorkspace(snapshot);
      setLastSaveNow();
    }

    // Destroy current Y.Doc and reload with new workspace
    destroyYjs();
    setWorkspaceLoaded(false);
    setPages([]);
    setCurrentPageId(null);

    // Update lastOpened for the workspace we're switching from
    if (currentWorkspace) {
      updateLastOpened(currentWorkspace.id);
    }

    setCurrentWorkspace(workspace);
    updateLastOpened(workspace.id);

    // Load new workspace
    loadWorkspace(workspace.id)
      .then(snapshot => {
        if (snapshot) {
          setPages(snapshot.pages);
          const currentPageExists = snapshot.pages.some(page => page.id === snapshot.currentPageId);
          setCurrentPageId(currentPageExists ? snapshot.currentPageId : snapshot.pages[0]?.id ?? null);
          backlinksIndex.rebuildFromPages(snapshot.pages).catch(err => console.warn('Backlinks index init failed', err));
        }
        setWorkspaceLoaded(true);
      })
      .catch(err => {
        console.error('Failed to load workspace', err);
        setWorkspaceLoaded(true);
      });
  };

  const handleCreateWorkspace = (name: string) => {
    const newWs = createWorkspace(name);
    setWorkspaces(prev => [...prev, newWs]);
    handleSwitchWorkspace(newWs);
  };

  const handleDeleteWorkspace = (id: string) => {
    deleteWorkspace(id);
    const updatedWorkspaces = workspaces.filter(w => w.id !== id);
    setWorkspaces(updatedWorkspaces);
    // If we deleted the current workspace, switch to another
    if (currentWorkspace?.id === id && updatedWorkspaces.length > 0) {
      handleSwitchWorkspace(updatedWorkspaces[0]);
    }
  };

  const handleRenameWorkspace = (id: string, name: string) => {
    renameWorkspace(id, name);
    setWorkspaces(prev => prev.map(w => w.id === id ? { ...w, name } : w));
    if (currentWorkspace?.id === id) {
      setCurrentWorkspace(prev => prev ? { ...prev, name } : null);
    }
  };

  const handleSaveSnapshot = () => {
    setLastSaveNow();

  // Move page to new parent
  const handleMovePage = (pageId: string) => {
    setMovePageId(pageId);
  };

  const handleMoveConfirm = (pageId: string, newParentId: string | null) => {
    setPages(prev => prev.map(p =>
      p.id === pageId ? { ...p, parentId: newParentId, updatedAt: Date.now() } : p
    ));
    setMovePageId(null);
  };

  const handleInstantiateTemplate = (template: WorkspaceTemplate) => {
    const newPages = instantiateTemplate(template);
    setPages(prev => [...prev, ...newPages]);
    if (newPages.length > 0) {
      setCurrentPageId(newPages[0].id);
    }
  };
    if (!currentPageId) return;
    const targetPage = pages.find(p => p.id === currentPageId);
    if (!targetPage) return;

    const newVersion = {
      id: uuidv4(),
      timestamp: Date.now(),
      title: targetPage.title || 'Untitled Snapshot',
      blocks: JSON.parse(JSON.stringify(targetPage.blocks)) // Deep clone blocks
    };

    const updatedPages = pages.map(p => {
      if (p.id === currentPageId) {
        return {
          ...p,
          versions: [newVersion, ...(p.versions || [])].slice(0, 15) // Keep up to 15 versions
        };
      }
      return p;
    });
    setPages(updatedPages);
    const changedPage = updatedPages.find(p => p.id === currentPageId);
    if (changedPage) savePage(changedPage);
  };

  const handleRestoreVersion = (version: any) => {
    if (!currentPageId) return;
    const confirmRestore = window.confirm(`Are you sure you want to revert to the snapshot from ${new Date(version.timestamp).toLocaleTimeString()}?`);
    if (!confirmRestore) return;

    // Create a snapshot of current state before reverting so user doesn't lose current work
    handleSaveSnapshot();

    const updatedPages = pages.map(p => {
      if (p.id === currentPageId) {
        return {
          ...p,
          title: version.title,
          blocks: JSON.parse(JSON.stringify(version.blocks)),
          updatedAt: Date.now()
        };
      }
      return p;
    });
    setPages(updatedPages);
    const changedPage = updatedPages.find(p => p.id === currentPageId);
    if (changedPage) savePage(changedPage);
  };

  const currentPage = pages.find(p => p.id === currentPageId);
  const currentBacklinks = currentPage ? backlinksIndex.getBacklinks(currentPage.title) : [];

  // E2EE: Lock/Unlock handlers
  const handleUnlockWorkspace = () => {
    if (!passphraseInput.trim()) {
      setPassphraseError('Passphrase cannot be empty');
      return;
    }
    setWorkspaceKey(passphraseInput.trim());
    setWorkspaceLocked(false);
    setPassphraseInput('');
    setPassphraseError('');
    // Offer to save key after successful unlock
    setShowSaveKeyPrompt(true);
    // Reload workspace from encrypted store with the now-available key
    reloadWorkspaceFromLegacyStore()
      .then(snapshot => {
        if (snapshot) {
          setPages(snapshot.pages);
          const currentPageExists = snapshot.pages.some(page => page.id === snapshot.currentPageId);
          setCurrentPageId(currentPageExists ? snapshot.currentPageId : snapshot.pages[0]?.id ?? null);
          backlinksIndex.rebuildFromPages(snapshot.pages).catch(err => console.warn('Backlinks index init failed', err));
        }
      })
      .catch(error => {
        console.error('Failed to reload workspace', error);
        clearWorkspaceKey();
        setWorkspaceLocked(true);
        setPassphraseError('Incorrect passphrase');
        setShowSaveKeyPrompt(false);
      });
  };

  const handleUnlockWithSavedKey = async () => {
    if (!currentWorkspace) return;
    try {
      const savedKey = await keychain.retrieveKey(currentWorkspace.id);
      if (!savedKey) {
        setSavedKeyAvailable(false);
        return;
      }
      setWorkspaceKey(savedKey);
      setWorkspaceLocked(false);
      // Reload workspace from encrypted store with the saved key
      const snapshot = await reloadWorkspaceFromLegacyStore();
      if (snapshot) {
        setPages(snapshot.pages);
        const currentPageExists = snapshot.pages.some(page => page.id === snapshot.currentPageId);
        setCurrentPageId(currentPageExists ? snapshot.currentPageId : snapshot.pages[0]?.id ?? null);
        backlinksIndex.rebuildFromPages(snapshot.pages).catch(err => console.warn('Backlinks index init failed', err));
      }
      // Key was already saved, no need to prompt to save again
      setShowSaveKeyPrompt(false);
    } catch (err) {
      console.error('Failed to unlock with saved key', err);
      setSavedKeyAvailable(false);
    }
  };

  const handleSaveKeyToKeychain = async () => {
    if (!currentWorkspace) return;
    const currentKey = passphraseInput.trim() || (await keychain.retrieveKey(currentWorkspace.id));
    if (currentKey) {
      await keychain.storeKey(currentWorkspace.id, currentKey);
    }
    setShowSaveKeyPrompt(false);
  };

  const handleSkipSaveKey = () => {
    setShowSaveKeyPrompt(false);
  };

  const handleLockWorkspace = () => {
    clearWorkspaceKey();
    setWorkspaceLocked(true);
    setPages([]);
    setCurrentPageId(null);
  };

  if (!workspaceLoaded) {
    return (
      <div className="flex h-[100dvh] items-center justify-center bg-[#FFFFFF] text-[#37352F] dark:bg-[#1C1C1C] dark:text-[#E3E3E3] font-sans">
        Loading workspace…
      </div>
    );
  }

  // E2EE: Locked screen
  if (workspaceLocked) {
    return (
      <div className="flex h-[100dvh] items-center justify-center bg-gradient-to-br from-purple-50 to-indigo-50 dark:from-purple-950/30 dark:to-indigo-950/30">
        <div className="w-full max-w-sm p-8 rounded-2xl shadow-xl bg-white dark:bg-[#1C1C1C] border border-purple-100 dark:border-purple-900">
          <div className="text-center mb-6">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-purple-100 dark:bg-purple-900/50 flex items-center justify-center">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-purple-600 dark:text-purple-400">
                <rect width="18" height="11" x="3" y="11" rx="2" ry="2"/>
                <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
              </svg>
            </div>
            <h2 className="text-xl font-bold text-[#37352F] dark:text-[#E3E3E3] mb-2">Workspace Locked</h2>
            <p className="text-sm text-gray-500 dark:text-stone-400">Enter your passphrase to unlock</p>
          </div>
          <div className="space-y-4">
            <div>
              <input
                type="password"
                value={passphraseInput}
                onChange={e => {
                  setPassphraseInput(e.target.value);
                  setPassphraseError('');
                }}
                onKeyDown={e => {
                  if (e.key === 'Enter') handleUnlockWorkspace();
                }}
                placeholder="Enter passphrase"
                className="w-full px-4 py-3 rounded-lg border border-gray-200 dark:border-stone-600 bg-white dark:bg-stone-800 text-[#37352F] dark:text-[#E3E3E3] focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                autoFocus
              />
              {passphraseError && (
                <p className="mt-2 text-sm text-red-600 dark:text-red-400">{passphraseError}</p>
              )}
            </div>
            <button
              onClick={handleUnlockWorkspace}
              className="w-full py-3 rounded-lg bg-purple-600 hover:bg-purple-700 text-white font-semibold transition-colors"
            >
              Unlock Workspace
            </button>
            {savedKeyAvailable && (
              <button
                onClick={handleUnlockWithSavedKey}
                className="w-full py-3 rounded-lg bg-white hover:bg-gray-50 dark:bg-stone-800 dark:hover:bg-stone-700 text-purple-600 dark:text-purple-400 font-semibold border border-purple-200 dark:border-purple-800 transition-colors"
              >
                Unlock with saved key
              </button>
            )}
            <p className="text-xs text-center text-gray-400 dark:text-stone-500">
              Your data is encrypted locally. Passphrase is not stored.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // E2EE: Post-unlock "Save key" prompt
  if (showSaveKeyPrompt) {
    return (
      <div className="flex h-[100dvh] items-center justify-center bg-gradient-to-br from-purple-50 to-indigo-50 dark:from-purple-950/30 dark:to-indigo-950/30">
        <div className="w-full max-w-sm p-8 rounded-2xl shadow-xl bg-white dark:bg-[#1C1C1C] border border-purple-100 dark:border-purple-900">
          <div className="text-center mb-6">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-green-100 dark:bg-green-900/50 flex items-center justify-center">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-green-600 dark:text-green-400">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
              </svg>
            </div>
            <h2 className="text-xl font-bold text-[#37352F] dark:text-[#E3E3E3] mb-2">Save encryption key?</h2>
            <p className="text-sm text-gray-500 dark:text-stone-400">
              Save your encryption key on this device so you don't need to enter your passphrase every time.
            </p>
          </div>
          <div className="space-y-3">
            <button
              onClick={handleSaveKeyToKeychain}
              className="w-full py-3 rounded-lg bg-purple-600 hover:bg-purple-700 text-white font-semibold transition-colors"
            >
              Save key for this device
            </button>
            <button
              onClick={handleSkipSaveKey}
              className="w-full py-3 rounded-lg bg-white hover:bg-gray-50 dark:bg-stone-800 dark:hover:bg-stone-700 text-gray-600 dark:text-stone-400 font-semibold border border-gray-200 dark:border-stone-600 transition-colors"
            >
              Skip — enter passphrase each time
            </button>
          </div>
          <p className="text-xs text-center text-gray-400 dark:text-stone-500 mt-4">
            Your key is stored securely on this device only.
          </p>
        </div>
      </div>
    );
  }

  return (
    <SettingsProvider>
    <div className="flex h-[100dvh] bg-[#FFFFFF] text-[#37352F] overflow-hidden font-sans relative">
      <CommandPalette
         isOpen={paletteOpen}
         onClose={() => setPaletteOpen(false)}
         pages={pages}
         onSelectPage={setCurrentPageId}
         currentPage={currentPage}
         activeBlockId={activeBlockId}
         onAiAction={(action) => {
           // Basic handle AI action by emitting a custom event the editor can listen to
           window.dispatchEvent(new CustomEvent('ai-command', { detail: { action } }));
         }}
         onInsertBlocks={(newBlocks) => {
           if (!currentPageId) return;
           // The first new block's ID to focus after insertion
           const firstNewBlockId = newBlocks.length > 0 ? newBlocks[0].id : null;
           setFocusAfterInsert(firstNewBlockId);
           setPages(prevPages => {
             const updated = prevPages.map(p => {
               if (p.id === currentPageId) {
                 const currentBlocks = p.blocks;
                 // Find the index of the active block
                 let insertIndex = currentBlocks.length;
                 if (activeBlockId) {
                   const activeIndex = currentBlocks.findIndex(b => b.id === activeBlockId);
                   if (activeIndex !== -1) {
                     insertIndex = activeIndex + 1;
                   }
                 }
                 const updatedBlocks = [...currentBlocks.slice(0, insertIndex), ...newBlocks, ...currentBlocks.slice(insertIndex)];
                 return {
                   ...p,
                   blocks: updatedBlocks,
                   updatedAt: Date.now()
                 };
               }
               return p;
             });
             const changedPage = updated.find(p => p.id === currentPageId);
             if (changedPage) savePage(changedPage);
             return updated;
           });
         }}
      />
    
      {/* Mobile Sidebar Overlay */}
      {sidebarOpen && (
         <div className="fixed inset-0 bg-black/20 z-40 md:hidden" onClick={() => setSidebarOpen(false)} />
      )}
      
      <div className={cn(
        "fixed md:static inset-y-0 left-0 z-50 transform transition-transform duration-200 ease-in-out md:transform-none md:flex",
        sidebarOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
      )}>
         <Sidebar
           pages={pages}
           currentPageId={currentPageId}
           onSelectPage={(id) => {
             setCurrentPageIdInStore(id);
             setCurrentPageId(id);
             if (viewMode === 'hub') {
               setViewMode('desktop');
             }
             if (window.innerWidth < 768) setSidebarOpen(false);
           }}
           onAddPage={addPage}
           onDeletePage={deletePageById}
           userEmail={user?.email || null}
           onLogin={handleLogin}
           onLogout={logout}
           onOpenDrive={() => setDriveModalOpen(true)}
           workspaces={workspaces}
           currentWorkspace={currentWorkspace}
           onSwitchWorkspace={handleSwitchWorkspace}
           onCreateWorkspace={handleCreateWorkspace}
           onDeleteWorkspace={handleDeleteWorkspace}
           onRenameWorkspace={handleRenameWorkspace}
         />
      </div>
      
      <div className="flex-1 flex overflow-hidden w-full relative">
        <main ref={scrollContainerRef} className={cn("flex-1 relative flex flex-col min-w-0 w-full", viewMode === 'desktop' ? "overflow-y-auto" : "overflow-hidden")}>
        <header className="sticky top-0 z-10 flex items-center px-4 bg-white/80 backdrop-blur-sm dark:bg-[#1C1C1C]/80 h-11 text-sm justify-between shrink-0 border-b border-gray-150 dark:border-stone-850">
           <div className="flex items-center space-x-2 text-[#37352f8c] dark:text-[#E3E3E3]/60">
             <button onClick={() => setSidebarOpen(!sidebarOpen)} className="p-1 hover:bg-[#F1F1F0] dark:hover:bg-[#2F2F2F] rounded mr-2">
                 <Menu size={16} />
             </button>
             <span className="hidden sm:inline truncate max-w-[100px]">{user?.email || 'Local Workspace'}</span>
             <span className="hidden sm:inline">/</span>
             <span className="text-[#37352F] dark:text-[#E3E3E3] font-medium truncate max-w-[125px] mr-2">{currentPage?.title || 'Untitled'}</span>
             
             <div className="flex items-center bg-gray-100 dark:bg-stone-800 p-0.5 rounded-lg border border-gray-150 dark:border-stone-700 select-none">
               <button 
                 onClick={() => setViewMode('hub')}
                 className={cn(
                   "flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-semibold cursor-pointer transition-all",
                   viewMode === 'hub'
                     ? "bg-purple-650 text-white shadow-xs font-bold" 
                     : "text-stone-500 hover:text-stone-850 dark:hover:text-stone-200"
                 )}
                 title="MotionAI Repository Handbook & Workspace Gaps roadmap dashboard"
               >
                 <Sparkles size={11} className={viewMode === 'hub' ? "text-yellow-300" : ""} />
                 <span className="hidden md:inline font-sans text-[11px]">MotionAI Portal</span>
               </button>
               <button 
                 onClick={() => setViewMode('desktop')}
                 className={cn(
                   "flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-semibold cursor-pointer transition-all",
                   viewMode === 'desktop'
                     ? "bg-white dark:bg-stone-900 text-stone-850 dark:text-stone-100 shadow-xs font-bold" 
                     : "text-stone-500 hover:text-stone-850 dark:hover:text-stone-200"
                 )}
               >
                 <Laptop size={11} />
                 <span className="hidden md:inline font-sans text-[11px]">Desktop</span>
               </button>
               <button 
                 onClick={() => setViewMode('mobile')}
                 className={cn(
                   "flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-semibold cursor-pointer transition-all",
                   viewMode === 'mobile'
                     ? "bg-white dark:bg-stone-900 text-stone-850 dark:text-stone-100 shadow-xs font-bold" 
                     : "text-stone-500 hover:text-stone-850 dark:hover:text-stone-200"
                 )}
               >
                 <Smartphone size={11} />
                 <span className="hidden md:inline font-sans text-[11px]">Mobile View</span>
               </button>
             </div>
           </div>
           <div className="flex items-center space-x-4">
             {user && (
               <button
                 onClick={() => setDriveModalOpen(true)}
                 className="flex items-center gap-1 text-xs bg-purple-50 dark:bg-purple-950/20 text-purple-600 dark:text-purple-400 border border-purple-200 dark:border-purple-800 hover:bg-purple-100/50 dark:hover:bg-purple-900/10 px-2.5 py-1.5 rounded font-medium transition-colors"
               >
                 <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-1"><path d="M12 3v18"/><path d="M3 12h18"/></svg>
                 Drive Sync
               </button>
             )}
             <button
               onClick={() => setTasksModalOpen(open => !open)}
               className="flex items-center gap-1 text-xs bg-purple-50 dark:bg-purple-950/20 text-purple-600 dark:text-purple-400 border border-purple-200 dark:border-purple-800 hover:bg-purple-100/50 dark:hover:bg-purple-900/10 px-2.5 py-1.5 rounded font-medium transition-colors"
               title="Open Google Tasks"
             >
               <CheckSquare size={12} className="mr-1" />
               Tasks
             </button>
             <button aria-label="Search" onClick={() => setPaletteOpen(true)} className="p-1 hover:bg-[#F1F1F0] dark:hover:bg-[#2F2F2F] rounded text-[#37352f8c]">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
             </button>
             <button aria-label="Dark Mode" onClick={() => setDarkMode(!darkMode)} className="p-1 hover:bg-[#F1F1F0] dark:hover:bg-[#2F2F2F] rounded text-[#37352f8c]" title={darkMode ? "Switch to Light Mode" : "Switch to Dark Mode"}>
                {darkMode ? (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-amber-400"><circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m6.34 17.66-1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"/></svg>
                ) : (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-slate-700"><path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/></svg>
                )}
             </button>
             <button
               aria-label="Lock Workspace"
               onClick={handleLockWorkspace}
               className="p-1 hover:bg-[#F1F1F0] dark:hover:bg-[#2F2F2F] rounded text-[#37352f8c] transition-colors"
               title="Lock Workspace"
             >
               <Lock size={14} />
             </button>
             <button
               aria-label={`AI Status: ${aiProviderStatus.label}`}
               onClick={() => setSettingsModalOpen(true)}
               className="relative p-1 hover:bg-[#F1F1F0] dark:hover:bg-[#2F2F2F] rounded text-[#37352f8c] transition-colors"
               title={`AI: ${aiProviderStatus.label}`}
             >
                <SettingsIcon size={14} />
                <span
                  className={cn(
                    "absolute top-0 right-0 w-2.5 h-2.5 rounded-full border border-white dark:border-[#1C1C1C]",
                    aiProviderStatus.color === 'green' && "bg-green-500",
                    aiProviderStatus.color === 'yellow' && "bg-yellow-500",
                    aiProviderStatus.color === 'red' && "bg-red-500"
                  )}
                />
             </button>
             {currentPage && (
                <div className="flex items-center gap-1.5 flex-row">
                  <button 
                     onClick={() => window.dispatchEvent(new CustomEvent('export-pdf'))}
                     className="flex items-center gap-1.5 px-2 py-1 text-xs font-semibold bg-white hover:bg-[#F1F1F0] dark:bg-[#1E1E1E] dark:hover:bg-[#2F2F2F] border border-[#EBEBE9] dark:border-[#2F2F2F] text-gray-600 dark:text-gray-300 rounded transition-colors cursor-pointer mr-2"
                     title="Export Current Page to PDF"
                   >
                     <Download size={13} className="text-purple-600 dark:text-purple-400" />
                     <span>Export PDF</span>
                   </button>
                   <span className="text-[#37352f8c] hidden sm:inline text-xs mr-1">Edited recently</span>
                   <PresenceIndicator peers={presencePeers} available={presenceAvailable} />
                  <button 
                    title="Open Document History & Collaboration"
                    onClick={() => setAddonsOpen(!addonsOpen)}
                    className={cn(
                      "flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded transition-colors relative border",
                      addonsOpen 
                        ? "bg-purple-50 dark:bg-purple-950/20 border-purple-200 dark:border-purple-800 text-purple-700 dark:text-purple-400 font-bold" 
                        : "bg-white hover:bg-[#F1F1F0] dark:bg-[#1E1E1E] dark:hover:bg-[#2F2F2F] border-[#EBEBE9] dark:border-[#2F2F2F] text-gray-600 dark:text-gray-300 font-medium"
                    )}
                  >
                    <History size={13} />
                    <span>History & Peers</span>
                    {collaborationActive && <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />}
                  </button>
                </div>
              )}
             {!user ? (
               <button onClick={handleLogin} className="text-sm bg-[#F7F6F3] border border-[#EBEBE9] text-[#37352F] hover:bg-[#EBEBE9] px-2 py-1 rounded">Link Workspace</button>
             ) : null}
           </div>
        </header>

        <div className="flex-1 w-full relative bg-gray-50 dark:bg-stone-900">
          {viewMode === 'hub' ? (
            <MotionAIHub />
          ) : viewMode === 'mobile' ? (
            <MobileWorkspaceApp 
              pages={pages}
              currentPageId={currentPageId}
              onSelectPage={setCurrentPageId}
              onAddPage={handleAddNewPageObj}
              onUpdatePage={updatePageById}
              onDeletePage={deletePageById}
              userEmail={user?.email || null}
            />
          ) : currentPage ? (
             currentPage.pageType === 'canvas' ? (
               <CanvasEditor 
                 key={currentPage.id} 
                 pageId={currentPage.id} 
                 pages={pages}
                 onSelectPage={setCurrentPageId}
               />
             ) : currentPage.pageType === 'dashboard' ? (
               <div className="w-full px-6 sm:px-12 py-12 pb-48 font-sans max-w-5xl mx-auto overflow-y-auto h-full">
                 <DashboardWidget pages={pages} onSelectPage={setCurrentPageId} />
               </div>
             ) : currentPage.pageType === 'database' ? (
                <div className="w-full px-6 sm:px-12 py-12 pb-48 font-sans max-w-5xl mx-auto overflow-y-auto h-full">
                  <div className="mb-6">
                    <TaskPropertiesPanel page={currentPage} onUpdatePage={updatePageById} />
                  </div>
                  {/* Full Page Database Header */}
                  <div className="flex items-center gap-3 mb-6 pb-4 border-b border-gray-150 dark:border-gray-800">
                    <span className="text-3xl select-none">{currentPage.icon || '📊'}</span>
                    <input
                      type="text"
                      value={currentPage.title}
                      onChange={(e) => updateCurrentPage({ title: e.target.value })}
                      className="text-3xl font-bold text-gray-800 dark:text-gray-100 bg-transparent border-0 outline-none w-full"
                      placeholder="Untitled Database"
                    />
                  </div>
                  {currentPage.blocks?.[0] ? (
                    <DatabaseBlock
                      block={currentPage.blocks[0]}
                      onChange={(updatedContent) => {
                        const updatedBlocks = [...currentPage.blocks];
                        updatedBlocks[0] = { ...updatedBlocks[0], content: updatedContent };
                        updateCurrentPage({ blocks: updatedBlocks });
                      }}
                      onRunAi={async (db, propertyId, rowId) => {
                        const prop = db.properties.find(p => p.id === propertyId);
                        const row = db.rows.find(r => r.id === rowId);
                        if (!prop || !row) return '';
                        return runAiFormula(db, prop, row);
                      }}
                    />
                  ) : (
                    <div className="text-gray-400 text-sm">Initializing Database...</div>
                  )}
                </div>
              ) : (
                <>
                  <div className="max-w-3xl mx-auto w-full px-6 sm:px-12 pt-8">
                    <TaskPropertiesPanel page={currentPage} onUpdatePage={updatePageById} />
                  </div>
                  <BlockEditor
                    key={currentPage.id}
                    title={currentPage.title}
                    onTitleChange={t => updateCurrentPage({ title: t })}
                    initialBlocks={currentPage.blocks}
                    onChange={b => updateCurrentPage({ blocks: b })}
                    onActiveBlockChange={setActiveBlockId}
                    focusAfterInsert={focusAfterInsert}
                    onFocusAfterInsertUsed={() => setFocusAfterInsert(null)}
                    onLockWorkspace={handleLockWorkspace}
                  />
                </>
             )
          ) : (
            <div className="flex h-full items-center justify-center p-6 text-center text-sm text-stone-500 dark:text-stone-400">
              <div>
                <p className="font-semibold text-stone-700 dark:text-stone-200">No pages in this workspace</p>
                <button onClick={() => addPage()} className="mt-3 rounded bg-stone-900 px-3 py-1.5 text-white dark:bg-stone-100 dark:text-stone-900">
                  Create a page
                </button>
              </div>
            </div>
          )}
        </div>
        </main>
        {addonsOpen && (
          <>
            {/* Mobile Backdrop Overlay */}
            <div 
              className="fixed inset-0 bg-black/40 backdrop-blur-xs z-40 md:hidden" 
              onClick={() => setAddonsOpen(false)} 
            />
            <div className="fixed md:static inset-y-0 right-0 z-50 w-80 shadow-xl md:shadow-none bg-[#FBFBFA] dark:bg-[#1C1C1C] flex flex-col h-full animate-in slide-in-from-right duration-250">
              <PageAddons
                currentPage={currentPage || null}
                onRestoreVersion={handleRestoreVersion}
                onSaveSnapshot={handleSaveSnapshot}
                collaborationActive={collaborationActive}
                onToggleCollaboration={setCollaborationActive}
                presencePeers={presencePeers}
                pages={pages}
                backlinks={currentBacklinks}
                onNavigateToPage={(pageId: string) => {
                  setCurrentPageId(pageId);
                  setAddonsOpen(false);
                }}
                onAddPage={addPage}
                encryptionLocked={syncStatus.encryptionLocked}
                encryptionKeySet={syncStatus.encryptionKeySet}
                lastSavedAt={syncStatus.lastSavedAt}
              />
            </div>
          </>
        )}
      </div>

      <DriveModal 
        isOpen={driveModalOpen} 
        onClose={() => setDriveModalOpen(false)} 
        currentPage={currentPage}
        onPageImported={handleImportDrivePage}
      />
      <TasksModal
        isOpen={tasksModalOpen}
        onClose={() => setTasksModalOpen(false)}
        currentPageContent={currentPage?.blocks.map(b => b.content).join('\n')}
      />
      <SettingsModal
        isOpen={settingsModalOpen}
        onClose={() => setSettingsModalOpen(false)}
      />
    </div>
    </SettingsProvider>
  );
}
