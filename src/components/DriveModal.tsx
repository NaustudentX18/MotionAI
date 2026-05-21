import React, { useState, useEffect } from 'react';
import { HardDrive, X, Loader2, FileText, Upload, Folder, CheckCircle, AlertCircle, Link2 } from 'lucide-react';
import { listGoogleDriveFiles, getGoogleDriveFileContent, createGoogleDriveFile, setupWorkspaceStructure, getWorkspaceStructureStatus, DriveFile, WorkspaceStructure } from '../lib/workspace';
import { Page, Block } from '../types';
import { v4 as uuidv4 } from 'uuid';
import { cn } from '../lib/utils';

interface DriveModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentPage: Page | undefined;
  onPageImported: (title: string, blocks: Block[]) => void;
}

type DriveStatus = 'not_connected' | 'listing' | 'setup_needed' | 'setup_complete' | 'error';

export function DriveModal({ isOpen, onClose, currentPage, onPageImported }: DriveModalProps) {
  const [loading, setLoading] = useState(false);
  const [driveStatus, setDriveStatus] = useState<DriveStatus>('listing');
  const [files, setFiles] = useState<DriveFile[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [exportSuccess, setExportSuccess] = useState(false);

  // Structured workspace layout state
  const [structuredFolderInfo, setStructuredFolderInfo] = useState<WorkspaceStructure | null>(null);
  const [settingUpStructure, setSettingUpStructure] = useState(false);
  const [selectedFolderId, setSelectedFolderId] = useState<string>('');

  useEffect(() => {
    if (isOpen) {
      loadFiles();
    } else {
      setExportSuccess(false);
      setError(null);
      setSelectedFolderId('');
    }
  }, [isOpen]);

  const loadFiles = async () => {
    setLoading(true);
    setDriveStatus('listing');
    setError(null);
    try {
      const driveFiles = await listGoogleDriveFiles();
      setFiles(driveFiles);

      const structure = await getWorkspaceStructureStatus();
      setStructuredFolderInfo(structure);
      setDriveStatus(structure ? 'setup_complete' : 'setup_needed');
    } catch (err: any) {
      const message = err.message || 'Failed connection to Google Drive';
      setError(message);
      setStructuredFolderInfo(null);
      setDriveStatus(message.includes('not connected') ? 'not_connected' : 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleSetupStructure = async () => {
    setSettingUpStructure(true);
    setError(null);
    try {
      const structure = await setupWorkspaceStructure();
      setStructuredFolderInfo(structure);
      setDriveStatus('setup_complete');
    } catch (err: any) {
      setError(err.message || 'Failed to set up Google Drive folders');
      setDriveStatus('error');
    } finally {
      setSettingUpStructure(false);
    }
  };

  // Automatically select the 'Projects & Work' folder as the default export destination
  useEffect(() => {
    if (structuredFolderInfo) {
      const sub = structuredFolderInfo.subfolders;
      setSelectedFolderId(sub["📂 Projects & Work"] || Object.values(sub)[0] || '');
    }
  }, [structuredFolderInfo]);

  const handleImport = async (file: DriveFile) => {
    setLoading(true);
    setError(null);
    try {
      const content = await getGoogleDriveFileContent(file.id, file.mimeType);
      
      // Parse content into blocks
      const lines = content.split('\n');
      const blocks: Block[] = lines
        .filter(l => l.trim().length > 0)
        .map(line => ({
          id: uuidv4(),
          type: 'p',
          content: line,
        }));

      if (blocks.length === 0) {
        blocks.push({ id: uuidv4(), type: 'p', content: '' });
      }

      onPageImported(file.name.replace(/\.[^/.]+$/, ""), blocks);
      onClose();
    } catch (err: any) {
      setError('Failed to import file content: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleExport = async () => {
    if (!currentPage) return;
    setExporting(true);
    setError(null);
    setExportSuccess(false);
    try {
      // Concatenate file contents
      const plainText = currentPage.blocks
        .map(b => {
          if (b.type === 'h1') return `# ${b.content}`;
          if (b.type === 'h2') return `## ${b.content}`;
          if (b.type === 'h3') return `### ${b.content}`;
          if (b.type === 'todo') return `[${b.checked ? 'x' : ' '}] ${b.content}`;
          if (b.type === 'bullet') return `- ${b.content}`;
          if (b.type === 'quote') return `> ${b.content}`;
          if (b.type === 'callout') return `[Callout] ${b.content}`;
          if (b.type === 'code') return `\`\`\`${b.language || 'javascript'}\n${b.content}\n\`\`\``;
          if (b.type === 'divider') return `---`;
          return b.content.replace(/<[^>]*>/g, ''); // strip inline HTML formatting tags for raw backup
        })
        .join('\n\n');

      const title = currentPage.title || 'Untitled';
      await createGoogleDriveFile(title, plainText, selectedFolderId || undefined);
      setExportSuccess(true);
      setTimeout(() => setExportSuccess(false), 3000);
    } catch (err: any) {
      setError('Failed to export page: ' + err.message);
    } finally {
      setExporting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4" onClick={onClose}>
      <div 
        className="w-full max-w-xl bg-white dark:bg-[#191919] rounded-xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200 border border-[#EBEBE9] dark:border-[#2F2F2F] flex flex-col max-h-[85vh]" 
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#EBEBE9] dark:border-[#2F2F2F]">
          <div className="flex items-center text-purple-600 dark:text-purple-400">
            <HardDrive className="mr-2" size={20} />
            <h3 className="font-semibold text-base text-[#37352F] dark:text-[#D4D4D4]">Google Drive Cloud Sync</h3>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-[#F1F1F0] dark:hover:bg-[#2F2F2F] rounded text-[#37352f7a]">
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {/* Drive connection and folder setup status */}
          <div className={cn(
            "p-4 rounded-xl border space-y-3",
            driveStatus === 'error' || driveStatus === 'not_connected'
              ? "bg-red-50/60 dark:bg-red-950/10 border-red-200 dark:border-red-900/20"
              : driveStatus === 'setup_complete'
                ? "bg-purple-50/20 dark:bg-purple-950/5 border-purple-100/50 dark:border-purple-900/10"
                : "bg-amber-50/40 dark:bg-amber-950/10 border-amber-100 dark:border-amber-900/20"
          )}>
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3 min-w-0">
                {driveStatus === 'listing' || settingUpStructure ? (
                  <Loader2 className="animate-spin text-amber-500 shrink-0 mt-0.5" size={18} />
                ) : driveStatus === 'setup_complete' ? (
                  <CheckCircle className="text-emerald-500 shrink-0 mt-0.5" size={18} />
                ) : driveStatus === 'not_connected' ? (
                  <Link2 className="text-red-500 shrink-0 mt-0.5" size={18} />
                ) : driveStatus === 'error' ? (
                  <AlertCircle className="text-red-500 shrink-0 mt-0.5" size={18} />
                ) : (
                  <Folder className="text-amber-500 shrink-0 mt-0.5" size={18} />
                )}
                <div className="text-xs min-w-0">
                  <div className={cn(
                    "font-bold",
                    driveStatus === 'error' || driveStatus === 'not_connected'
                      ? "text-red-700 dark:text-red-400"
                      : driveStatus === 'setup_complete'
                        ? "text-purple-700 dark:text-purple-400"
                        : "text-amber-800 dark:text-amber-400"
                  )}>
                    {driveStatus === 'listing' && 'Listing Drive files...'}
                    {driveStatus === 'not_connected' && 'Google Drive not connected'}
                    {driveStatus === 'setup_needed' && 'Folder setup needed'}
                    {driveStatus === 'setup_complete' && 'Folder setup complete'}
                    {driveStatus === 'error' && 'Google Drive error'}
                  </div>
                  <div className="text-[#37352f99] dark:text-gray-400 mt-0.5">
                    {driveStatus === 'setup_complete'
                      ? 'Exports can be placed into the MotionAI Workspace folders below.'
                      : driveStatus === 'setup_needed'
                        ? 'Opening this modal only lists files. Create the MotionAI Workspace folders when you choose.'
                        : driveStatus === 'not_connected'
                          ? 'Use Link Workspace to approve Google access, then reopen Drive Sync.'
                          : driveStatus === 'error'
                            ? 'Check the message below, then reconnect if Google says the token or scopes are invalid.'
                            : 'Reading importable Docs/text files and checking whether the workspace folders already exist.'}
                  </div>
                </div>
              </div>
              {driveStatus !== 'setup_complete' && driveStatus !== 'not_connected' && (
                <button
                  type="button"
                  onClick={handleSetupStructure}
                  disabled={settingUpStructure || loading}
                  className="shrink-0 flex items-center px-3 py-1.5 text-xs font-semibold bg-purple-650 hover:bg-purple-700 text-white rounded-lg transition-colors cursor-pointer disabled:opacity-50"
                >
                  {settingUpStructure ? <Loader2 className="animate-spin mr-1.5" size={12} /> : <Folder className="mr-1.5" size={12} />}
                  Create folders
                </button>
              )}
            </div>

            {structuredFolderInfo && (
              <div className="grid grid-cols-2 gap-2 text-[11px] text-[#37352F] dark:text-gray-300 pt-2 border-t border-purple-100/20">
                {Object.keys(structuredFolderInfo.subfolders).map((fName) => (
                  <div key={fName} className="flex items-center gap-1.5 bg-[#F4F4F3]/50 dark:bg-[#1E1E1E] px-2.5 py-1.5 rounded-md border border-[#EBEBE9] dark:border-[#2F2F2F] font-medium">
                    <span className="text-emerald-500 text-xs">✓</span>
                    <span className="truncate">{fName}</span>
                  </div>
                ))}
              </div>
            )}

            <div className="text-[10px] leading-relaxed text-[#37352f7a] dark:text-gray-500">
              Google permissions: Drive read-only lists/imports existing Docs and text files; Drive file creates and manages only files/folders this app creates. Calendar and Tasks scopes power the existing Workspace actions outside this dialog.
            </div>
          </div>

          {/* Export Panel Block */}
          {currentPage && (
            <div className="p-4 rounded-xl border border-gray-150 dark:border-[#2F2F2F] bg-[#F4F4F3]/30 dark:bg-[#1A1A1A]/30 space-y-3">
              <div className="flex items-start justify-between">
                <div>
                  <h4 className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Drive Export</h4>
                  <p className="text-sm font-semibold text-[#37352F] dark:text-[#D4D4D4] mt-0.5">Export "{currentPage.title || 'Untitled'}"</p>
                </div>
                <button 
                  onClick={handleExport}
                  disabled={exporting || settingUpStructure || driveStatus === 'not_connected'}
                  className="flex items-center px-3 py-1.5 text-xs font-semibold bg-purple-650 hover:bg-purple-700 text-white rounded-lg transition-colors cursor-pointer disabled:opacity-50 shadow-xs"
                >
                  {exporting ? (
                    <Loader2 className="animate-spin mr-1.5" size={12} />
                  ) : (
                    <Upload className="mr-1.5" size={12} />
                  )}
                  Export File
                </button>
              </div>
              {!structuredFolderInfo && (
                <div className="text-[11px] text-[#37352f7a] dark:text-gray-400 pt-2 border-t border-[#EBEBE9] dark:border-[#2F2F2F]">
                  Folder setup has not been created. Export will save to your Drive root unless you explicitly create the MotionAI Workspace folders above.
                </div>
              )}
              {structuredFolderInfo && (
                <div className="space-y-2 pt-2 border-t border-[#EBEBE9] dark:border-[#2F2F2F]">
                  <div className="flex items-center justify-between text-[11px] font-bold text-gray-400 dark:text-gray-550 uppercase tracking-wider">
                    <span>Select target directory</span>
                    <span className="text-purple-600 dark:text-purple-400 font-mono font-bold text-[9px] lowercase bg-purple-50 dark:bg-purple-950/30 px-1.5 py-0.5 rounded-sm">default destination</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {Object.entries(structuredFolderInfo.subfolders).map(([folderName, folderId]) => {
                      const isSelected = selectedFolderId === folderId;
                      const isDefaultOption = folderName === "📂 Projects & Work";
                      return (
                        <button
                          key={folderId}
                          onClick={() => setSelectedFolderId(folderId)}
                          className={cn(
                            "p-2 text-left rounded-lg text-xs font-medium border transition-all flex items-center justify-between cursor-pointer",
                            isSelected
                              ? "bg-purple-50 dark:bg-purple-950/20 text-purple-700 dark:text-purple-300 border-purple-400 dark:border-purple-800 font-semibold"
                              : "bg-white dark:bg-[#191919] border-[#EBEBE9] dark:border-[#2F2F2F] text-gray-600 dark:text-gray-400 hover:bg-[#F1F1F0]/50"
                          )}
                        >
                          <div className="flex items-center gap-1.5 min-w-0">
                            <span className="truncate">{folderName}</span>
                            {isDefaultOption && (
                              <span className="shrink-0 text-[8px] px-1 py-0.5 bg-purple-105 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 rounded-sm font-bold uppercase tracking-wide border border-purple-200 dark:border-purple-900/35">
                                Default
                              </span>
                            )}
                          </div>
                          {isSelected && <span className="text-[10px] text-purple-600 dark:text-purple-400 shrink-0">●</span>}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {exportSuccess && (
            <div className="p-3 bg-emerald-50 dark:bg-emerald-950/10 border border-emerald-200 dark:border-emerald-900/25 text-emerald-800 dark:text-emerald-400 text-xs rounded-xl text-center font-bold">
              Export completed: page saved to Google Drive.
            </div>
          )}

          {error && (
            <div className="p-3 bg-red-50 dark:bg-red-950/10 border border-red-200 dark:border-red-900/20 text-red-600 dark:text-red-400 text-xs rounded-lg text-center">
              ⚠️ {error}
            </div>
          )}

          <div className="pt-2 border-t border-[#EBEBE9] dark:border-[#2F2F2F]">
            <h4 className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">Import from Google Drive</h4>
            {loading ? (
              <div className="p-10 flex flex-col items-center justify-center text-purple-600 space-y-2">
                <Loader2 className="animate-spin" size={24} />
                <span className="text-xs font-medium">Connecting to your Cloud Files...</span>
              </div>
            ) : files.length === 0 ? (
              <div className="text-center p-8 text-[#37352f7a] dark:text-gray-400 text-sm border-2 border-dashed border-[#EBEBE9] dark:border-[#2F2F2F] rounded-lg">
                No importable Google Docs or text files found in your Google Drive.
              </div>
            ) : (
              <div className="border border-[#EBEBE9] dark:border-[#2F2F2F] rounded-lg divide-y divide-[#EBEBE9] dark:divide-[#2F2F2F] max-h-40 overflow-y-auto">
                {files.map(file => (
                  <button
                    key={file.id}
                    onClick={() => handleImport(file)}
                    className="w-full flex items-center justify-between p-3 text-left hover:bg-[#F1F1F0] dark:hover:bg-[#2F2F2F] transition-colors group"
                  >
                    <div className="flex items-center space-x-3 truncate">
                      <FileText className="text-[#37352f8c] group-hover:text-purple-600 shrink-0" size={16} />
                      <div className="truncate">
                        <div className="text-xs font-medium text-[#37352F] dark:text-[#D4D4D4] truncate">{file.name}</div>
                        <div className="text-[10px] text-[#37352f7a] dark:text-gray-400 truncate">
                          {file.mimeType.includes('document') ? 'Google Doc' : 'Text File'}
                        </div>
                      </div>
                    </div>
                    <span className="text-[11px] font-semibold text-purple-600 dark:text-purple-400 opacity-0 group-hover:opacity-100 transition-opacity">
                      Import →
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
