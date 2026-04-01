"use client";

import { useEffect, useRef, useState } from "react";

type Props = {
  id: string;
  title: string;
  isActive: boolean;
  onClick: () => void;
  onRename: (newTitle: string) => Promise<void>;
  onDelete: () => Promise<void>;
};

export default function SidebarChatItem({
  id,
  title,
  isActive,
  onClick,
  onRename,
  onDelete,
}: Props) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(title);
  const [isDeleting, setIsDeleting] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setEditValue(title);
  }, [title]);

  useEffect(() => {
    if (isEditing) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [isEditing]);

  async function handleRenameCommit() {
    const trimmed = editValue.trim();
    if (!trimmed || trimmed === title) {
      setEditValue(title);
      setIsEditing(false);
      return;
    }
    await onRename(trimmed);
    setIsEditing(false);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") handleRenameCommit();
    if (e.key === "Escape") {
      setEditValue(title);
      setIsEditing(false);
    }
  }

  async function handleDelete(e: React.MouseEvent) {
    e.stopPropagation();
    setIsDeleting(true);
    try {
      await onDelete();
    } finally {
      setIsDeleting(false);
    }
  }

  function handleEditClick(e: React.MouseEvent) {
    e.stopPropagation();
    setIsEditing(true);
  }

  if (isEditing) {
    return (
      <div className="relative mb-1 flex items-center">
        <input
          ref={inputRef}
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onBlur={handleRenameCommit}
          onKeyDown={handleKeyDown}
          maxLength={100}
          className="w-full rounded-lg border border-blue-400 bg-blue-50 px-3 py-2 text-sm text-gray-800 outline-none"
        />
      </div>
    );
  }

  return (
    <div
      className={`group mb-1 flex min-w-0 items-center rounded-lg transition-colors ${
        isActive ? "bg-blue-50" : "hover:bg-gray-100"
      }`}
    >
      <button
        onClick={onClick}
        className={`min-w-0 flex-1 truncate px-3 py-2 text-left text-sm ${
          isActive ? "text-blue-700 font-medium" : "text-gray-600"
        }`}
      >
        {title}
      </button>

      <div className="hidden shrink-0 items-center gap-0.5 pr-1 group-hover:flex">
        <button
          onClick={handleEditClick}
          title="Переименовать"
          className="rounded p-1 text-gray-400 hover:bg-gray-200 hover:text-gray-600"
        >
          <PencilIcon />
        </button>
        <button
          onClick={handleDelete}
          disabled={isDeleting}
          title="Удалить"
          className="rounded p-1 text-gray-400 hover:bg-red-100 hover:text-red-500 disabled:opacity-50"
        >
          <TrashIcon />
        </button>
      </div>
    </div>
  );
}

function PencilIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
      <path d="M10 11v6" />
      <path d="M14 11v6" />
      <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
    </svg>
  );
}
