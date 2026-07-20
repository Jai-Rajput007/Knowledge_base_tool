import React from 'react';
import { AlertTriangle, Info, AlertCircle, FileText } from 'lucide-react';

interface CalloutProps {
  type?: 'info' | 'warning' | 'danger' | 'note';
  title?: string;
  children: React.ReactNode;
}

export function Callout({ type = 'info', title, children }: CalloutProps) {
  const styles = {
    info: "bg-blue-500/10 border-blue-500/20 text-blue-700 dark:text-blue-400",
    warning: "bg-amber-500/10 border-amber-500/20 text-amber-700 dark:text-amber-400",
    danger: "bg-red-500/10 border-red-500/20 text-red-700 dark:text-red-400",
    note: "bg-muted/50 border-border text-foreground",
  };

  const icons = {
    info: <Info className="w-5 h-5 text-blue-500" />,
    warning: <AlertTriangle className="w-5 h-5 text-amber-500" />,
    danger: <AlertCircle className="w-5 h-5 text-red-500" />,
    note: <FileText className="w-5 h-5 text-muted-foreground" />,
  };

  return (
    <div className={`my-6 flex items-start gap-3 p-4 rounded-xl border ${styles[type]}`}>
      <div className="mt-0.5 flex-shrink-0">{icons[type]}</div>
      <div className="flex-1 text-sm leading-relaxed">
        {title && <div className="font-semibold mb-1 text-foreground">{title}</div>}
        <div className="opacity-90">{children}</div>
      </div>
    </div>
  );
}
