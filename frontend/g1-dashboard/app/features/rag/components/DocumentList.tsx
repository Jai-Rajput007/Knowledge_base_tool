import React from "react";
import { Document, DocumentStatus } from "../types";

interface DocumentListProps {
  documents: Document[];
  onDelete: (id: string) => void;
  onReindex: (id: string) => void;
}

const fileTypeIcons: Record<string, string> = {
  PDF: "M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z",
  DOCX: "M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z",
  TXT: "M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z",
  MD: "M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z",
};

export function DocumentList({ documents, onDelete, onReindex }: DocumentListProps) {
  if (documents.length === 0) {
    return (
      <div className="p-8 text-center border border-border bg-card/20 text-muted-foreground font-mono text-sm">
        // No documents found in the current filter context
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left border-collapse">
        <thead>
          <tr className="border-b border-border bg-secondary/20">
            <th className="py-4 px-4 text-xs font-mono uppercase tracking-wider text-muted-foreground font-normal">Document Name</th>
            <th className="py-4 px-4 text-xs font-mono uppercase tracking-wider text-muted-foreground font-normal">Type</th>
            <th className="py-4 px-4 text-xs font-mono uppercase tracking-wider text-muted-foreground font-normal">Size</th>
            <th className="py-4 px-4 text-xs font-mono uppercase tracking-wider text-muted-foreground font-normal">Status</th>
            <th className="py-4 px-4 text-xs font-mono uppercase tracking-wider text-muted-foreground font-normal text-right">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {documents.map((doc) => (
            <tr key={doc.id} className="group hover:bg-secondary/10 transition-colors">
              <td className="py-4 px-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-secondary/50 text-muted-foreground">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d={fileTypeIcons[doc.type] || fileTypeIcons.TXT} />
                    </svg>
                  </div>
                  <div>
                    <p className="font-medium text-foreground">{doc.name}</p>
                    <p className="text-[10px] font-mono text-muted-foreground mt-0.5">Uploaded {doc.uploadedAt}</p>
                  </div>
                </div>
              </td>
              <td className="py-4 px-4">
                <span className="text-xs font-mono bg-secondary px-2 py-1 uppercase tracking-wider">{doc.type}</span>
              </td>
              <td className="py-4 px-4 text-sm font-mono">{doc.size}</td>
              <td className="py-4 px-4">
                <div className="flex items-center gap-2">
                  <span className={`w-2 h-2 ${
                    doc.status === 'indexed' ? 'bg-green-500' :
                    doc.status === 'processing' ? 'bg-yellow-500 animate-pulse' :
                    'bg-red-500'
                  }`} />
                  <span className="text-xs font-mono uppercase tracking-wider">{doc.status}</span>
                </div>
              </td>
              <td className="py-4 px-4 text-right">
                <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={() => onReindex(doc.id)} className="p-2 text-muted-foreground hover:text-primary transition-colors" title="Reindex">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                  </button>
                  <button onClick={() => onDelete(doc.id)} className="p-2 text-muted-foreground hover:text-red-500 transition-colors" title="Delete">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
