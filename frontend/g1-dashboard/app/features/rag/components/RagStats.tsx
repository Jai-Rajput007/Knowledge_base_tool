import React from "react";
import { Document } from "../types";

export function RagStats({ documents, formatFileSize }: { documents: Document[], formatFileSize: (b: number) => string }) {
  const totalSize = documents.reduce((acc, doc) => {
    const size = parseFloat(doc.size.split(" ")[0]);
    const unit = doc.size.split(" ")[1];
    let bytes = size;
    if (unit === "KB") bytes *= 1024;
    if (unit === "MB") bytes *= 1024 * 1024;
    return acc + bytes;
  }, 0);

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
      <div className="bg-background border border-border p-4">
        <p className="text-muted-foreground text-[10px] font-mono uppercase tracking-wider">Total Docs</p>
        <p className="text-2xl font-bold text-card-foreground mt-1 font-mono">{documents.length}</p>
      </div>
      <div className="bg-background border border-border p-4">
        <p className="text-muted-foreground text-[10px] font-mono uppercase tracking-wider">Indexed</p>
        <p className="text-2xl font-bold text-green-600 mt-1 font-mono">{documents.filter(d => d.status === "indexed").length}</p>
      </div>
      <div className="bg-background border border-border p-4">
        <p className="text-muted-foreground text-[10px] font-mono uppercase tracking-wider">Processing</p>
        <p className="text-2xl font-bold text-yellow-600 mt-1 font-mono">{documents.filter(d => d.status === "processing").length}</p>
      </div>
      <div className="bg-background border border-border p-4">
        <p className="text-muted-foreground text-[10px] font-mono uppercase tracking-wider">Total Size</p>
        <p className="text-2xl font-bold text-card-foreground mt-1 font-mono">{formatFileSize(totalSize)}</p>
      </div>
    </div>
  );
}
