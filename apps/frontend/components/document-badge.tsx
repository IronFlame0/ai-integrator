"use client";

import { useRef, useState, useEffect } from "react";
import { fetchDocuments, deleteDocument, type Document } from "@/lib/documents";

// --- DocumentBadge: плашка прикреплённого документа ---

type BadgeProps = {
  filename: string;
  uploading?: boolean;
  onDetach: () => void;
};

export default function DocumentBadge({ filename, uploading, onDetach }: BadgeProps) {
  return (
    <div className="flex items-center gap-2 flex-wrap">
      <div
        className="flex items-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-2.5 py-1 text-xs text-red-700 max-w-xs"
        title="Только текст — изображения, графики и таблицы-как-картинки не анализируются"
      >
        <PdfIcon className="shrink-0 h-4 w-4 text-red-500" />
        <span className="truncate max-w-[160px]">{filename}</span>
        <button
          onClick={onDetach}
          className="ml-0.5 shrink-0 rounded-full p-0.5 hover:bg-red-200 transition-colors"
          title="Открепить документ"
          type="button"
        >
          <svg className="h-3 w-3" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M2 2l8 8M10 2l-8 8" />
          </svg>
        </button>
      </div>

      <span
        className="text-xs text-gray-400 cursor-default"
        title="Только текст — изображения, графики и таблицы-как-картинки не анализируются"
      >
        только текст
      </span>

      {uploading && (
        <span className="text-xs text-gray-400 animate-pulse">Загрузка...</span>
      )}
    </div>
  );
}

// --- DocumentPicker: кнопка + дропдаун со списком ---

type PickerProps = {
  uploading?: boolean;
  onUpload: (file: File) => void;
  onSelect: (doc: Document) => void;
};

export function DocumentPicker({ uploading, onUpload, onSelect }: PickerProps) {
  const [open, setOpen] = useState(false);
  const [docs, setDocs] = useState<Document[]>([]);
  const [loading, setLoading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Закрываем при клике вне
  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  async function handleOpen() {
    if (open) { setOpen(false); return; }
    setOpen(true);
    setLoading(true);
    try {
      const list = await fetchDocuments();
      setDocs(list);
    } finally {
      setLoading(false);
    }
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) {
      setOpen(false);
      onUpload(file);
    }
    e.target.value = "";
  }

  async function handleDelete(docId: string, e: React.MouseEvent) {
    e.stopPropagation();
    setDeletingId(docId);
    try {
      await deleteDocument(docId);
      setDocs((prev) => prev.filter((d) => d.id !== docId));
    } finally {
      setDeletingId(null);
    }
  }

  function handleSelect(doc: Document) {
    setOpen(false);
    onSelect(doc);
  }

  return (
    <div ref={containerRef} className="relative shrink-0">
      <button
        type="button"
        onClick={handleOpen}
        disabled={uploading}
        title="Прикрепить PDF"
        className={`rounded-lg border px-2 py-2 transition-colors disabled:opacity-50
          ${open
            ? "border-blue-400 bg-blue-50 text-blue-600"
            : "border-gray-200 text-gray-500 hover:bg-gray-50 hover:text-gray-700"
          }`}
      >
        {uploading ? <SpinIcon className="h-4 w-4" /> : <PdfIcon className="h-4 w-4" />}
      </button>

      {open && (
        <div className="absolute bottom-full mb-1 left-0 z-20 w-64 rounded-xl border border-gray-200 bg-white shadow-lg overflow-hidden">

          {/* Загрузить новый */}
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="flex w-full items-center gap-2 px-3 py-2.5 text-sm text-blue-600 hover:bg-blue-50 border-b border-gray-100 transition-colors"
          >
            <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
              <polyline points="17 8 12 3 7 8" />
              <line x1="12" y1="3" x2="12" y2="15" />
            </svg>
            Загрузить новый PDF
          </button>

          {/* Список */}
          <div className="max-h-52 overflow-y-auto">
            {loading && (
              <p className="px-3 py-4 text-xs text-center text-gray-400 animate-pulse">Загрузка списка...</p>
            )}
            {!loading && docs.length === 0 && (
              <p className="px-3 py-4 text-xs text-center text-gray-400">Нет загруженных документов</p>
            )}
            {!loading && docs.map((doc) => (
              <div
                key={doc.id}
                onClick={() => handleSelect(doc)}
                className="flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-gray-50 group transition-colors"
              >
                <PdfIcon className="h-4 w-4 shrink-0 text-red-400" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-700 truncate">{doc.filename}</p>
                  <p className="text-xs text-gray-400">{formatSize(doc.file_size)}</p>
                </div>
                <button
                  type="button"
                  onClick={(e) => handleDelete(doc.id, e)}
                  disabled={deletingId === doc.id}
                  title="Удалить документ"
                  className="shrink-0 rounded p-1 text-gray-300 hover:text-red-500 hover:bg-red-50 opacity-0 group-hover:opacity-100 transition-all disabled:opacity-50"
                >
                  {deletingId === doc.id
                    ? <SpinIcon className="h-3.5 w-3.5" />
                    : <TrashIcon className="h-3.5 w-3.5" />
                  }
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <input ref={fileInputRef} type="file" accept=".pdf" className="hidden" onChange={handleFileChange} />
    </div>
  );
}

// --- Утилиты ---

function formatSize(bytes: number): string {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} Б`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} КБ`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} МБ`;
}

function PdfIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <path d="M9 13h2m4 0h-2m-2 0v4" strokeLinecap="round" />
    </svg>
  );
}

function SpinIcon({ className }: { className?: string }) {
  return (
    <svg className={`${className} animate-spin`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
    </svg>
  );
}

function TrashIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" />
      <path d="M10 11v6M14 11v6" />
      <path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2" />
    </svg>
  );
}
