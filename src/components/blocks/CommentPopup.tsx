import React from 'react';
import { X } from 'lucide-react';
import { cn } from '../../lib/utils';
import { BlockComment } from '../../types';

interface CommentPopupProps {
  blockId: string;
  comments: BlockComment[];
  newCommentText: string;
  onSetNewCommentText: (text: string) => void;
  onAddComment: (blockId: string) => void;
  onRemoveComment: (blockId: string, commentId: string) => void;
  onClose: () => void;
}

export function CommentPopup({
  blockId,
  comments,
  newCommentText,
  onSetNewCommentText,
  onAddComment,
  onRemoveComment,
  onClose
}: CommentPopupProps) {
  return (
    <div className="absolute right-0 top-8 bg-white dark:bg-[#252525] border border-[#EBEBE9] dark:border-[#2F2F2F] rounded-lg shadow-lg p-3.5 z-30 w-72 text-xs text-[#37352F] dark:text-gray-200 pdf-exclude">
      <div className="flex items-center justify-between mb-2 pb-1 border-b border-[#EBEBE9] dark:border-[#2F2F2F]">
        <span className="font-bold uppercase tracking-wider text-[10px] text-purple-600">Block Comments</span>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-650"><X size={12} /></button>
      </div>
      <div className="max-h-40 overflow-y-auto space-y-2 mb-3 pr-1 leading-normal">
        {(!comments || comments.length === 0) ? (
          <div className="text-gray-400 italic text-[11px] py-4 text-center">No comments yet. Add a quick note below!</div>
        ) : (
          comments.map(comment => (
            <div key={comment.id} className="p-2 bg-gray-50 dark:bg-gray-800/40 rounded border border-gray-100 dark:border-gray-800/60 relative group/comment">
              <div className="flex items-center justify-between pointer-events-none">
                <span className="font-semibold text-[10px] text-indigo-600">{comment.author}</span>
                <span className="text-[8px] text-gray-400">{new Date(comment.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
              </div>
              <p className="text-[11px] mt-0.5 text-gray-600 dark:text-gray-200">{comment.text}</p>
              <button
                onClick={() => onRemoveComment(blockId, comment.id)}
                className="absolute right-1 top-1 text-red-400 hover:text-red-500 cursor-pointer opacity-0 group-hover/comment:opacity-100 transition-opacity"
                title="Delete comment"
              >
                <X size={10} />
              </button>
            </div>
          ))
        )}
      </div>
      <div className="flex gap-1.5 items-center">
        <input
          type="text"
          value={newCommentText}
          onChange={e => onSetNewCommentText(e.target.value)}
          placeholder="Add comment..."
          onKeyDown={e => { if (e.key === 'Enter') onAddComment(blockId); }}
          className="flex-1 bg-[#F1F1F0] dark:bg-[#1E1E1E] rounded text-[11px] px-2.5 py-1.5 outline-none border border-transparent focus:border-purple-300 text-[#37352F] dark:text-gray-200"
        />
        <button
          onClick={() => onAddComment(blockId)}
          className="p-1 px-3 bg-purple-600 hover:bg-purple-750 text-white rounded text-[11px] font-semibold cursor-pointer"
        >
          Add
        </button>
      </div>
    </div>
  );
}

export default CommentPopup;
