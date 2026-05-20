import React, { useState, useEffect } from 'react';
import { HardDrive, X, Loader2, FileText, Upload, Download } from 'lucide-react';
import { listGoogleDriveFiles, getGoogleDriveFileContent, createGoogleDriveFile, DriveFile } from '../lib/workspace';
import { Page, Block } from '../types';
import { v4 as uuidv4 } from 'uuid';

interface DriveModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentPage: Page | undefined;
  onPageImported: (title: string, blocks: Block[]) => void;
}

export function DriveModal({ isOpen, onClose, currentPage, onPageImported }: DriveModalProps) {
  const [loading, setLoading] = useState(false);
  const [files, setFiles] = useState<DriveFile[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [exportSuccess, setExportSuccess] = useState(false);

  useEffect(() => {
    if (isOpen) {
      loadFiles();
    } else {
      setExportSuccess(false);
      setError(null);
    }
  }, [isOpen]);

  const loadFiles = async () => {
    setLoading(true);
    setError(null);
    try {
      const driveFiles = await listGoogleDriveFiles();
      setFiles(driveFiles);
    } catch (err: any) {
      setError(err.message || 'Failed to connection to Google Drive');
    } finally {
      setLoading(false);
    }
  };

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
          if (b.type === 'divider') return `---`;
          return b.content;
        })
        .join('\n\n');

      const title = currentPage.title || 'Untitled';
      await createGoogleDriveFile(title, plainText);
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
        className="w-full max-w-xl bg-white dark:bg-[#191919] rounded-xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200 border border-[#EBEBE9] dark:border-[#2F2F2F] flex flex-col max-h-[80vh]" 
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
          {currentPage && (
            <div className="p-4 rounded-lg bg-purple-50/50 dark:bg-purple-950/10 border border-purple-100 dark:border-purple-900/20 flex items-center justify-between">
              <div>
                <h4 className="text-sm font-medium text-[#37352F] dark:text-[#D4D4D4]">Export Current Page</h4>
                <p className="text-xs text-[#37352f7a] dark:text-gray-400">Save "{currentPage.title || 'Untitled'}" as a text file in Google Drive.</p>
              </div>
              <button 
                onClick={handleExport}
                disabled={exporting}
                className="flex items-center px-3 py-1.5 text-xs font-semibold bg-purple-600 hover:bg-purple-700 text-white rounded transition-colors disabled:opacity-50"
              >
                {exporting ? (
                  <Loader2 className="animate-spin mr-1.5" size={12} />
                ) : (
                  <Upload className="mr-1.5" size={12} />
                )}
                Export to Drive
              </button>
            </div>
          )}

          {exportSuccess && (
            <div className="p-3 bg-green-50 dark:bg-green-950/10 border border-green-200 dark:border-green-900/20 text-green-700 dark:text-green-400 text-xs rounded text-center font-medium">
              ✨ Page successfully exported to your Google Drive!
            </div>
          )}

          {error && (
            <div className="p-3 bg-red-50 dark:bg-red-950/10 border border-red-200 dark:border-red-900/20 text-red-600 dark:text-red-400 text-xs rounded text-center">
              ⚠️ {error}
            </div>
          )}

          <div>
            <h4 className="text-sm font-medium text-[#37352F] dark:text-[#D4D4D4] mb-2">Import from Google Drive</h4>
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
              <div className="border border-[#EBEBE9] dark:border-[#2F2F2F] rounded-lg divide-y divide-[#EBEBE9] dark:divide-[#2F2F2F] max-h-60 overflow-y-auto">
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
