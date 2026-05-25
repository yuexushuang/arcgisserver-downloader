import React from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { useEffect } from 'react';

export default function LogPanel({ logs, progress, status, logRef, collapsed, onToggleCollapse }) {
  useEffect(() => {
    if (logRef?.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight;
    }
  }, [logs, logRef]);

  if (!logs.length && status === 'idle') {
    return null;
  }

  const width = progress.total > 0 ? (progress.current / progress.total) * 100 : 0;
  const barClassName =
    status === 'error' ? 'bg-rose-500' : status === 'success' ? 'bg-emerald-500' : 'bg-sky-600';

  if (collapsed) {
    return null;
  }

  return (
    <section className="min-h-0 overflow-hidden rounded-[16px] border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-slate-800">执行日志</h2>
        <div className="flex items-center gap-2">
          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">
            {progress.current} / {progress.total}
          </span>
          <button
            type="button"
            onClick={onToggleCollapse}
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-600 transition hover:bg-slate-100"
            title={collapsed ? '展开' : '收起'}
          >
            {collapsed ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>
        </div>
      </div>

      <div className="mb-4 h-3 overflow-hidden rounded-full bg-slate-100">
        <div className={`h-full transition-all duration-300 ${barClassName}`} style={{ width: `${width}%` }} />
      </div>

      <div className="h-[180px] max-w-full overflow-hidden rounded-xl bg-slate-950">
        <div ref={logRef} className="h-full overflow-x-hidden overflow-y-auto p-4 font-mono text-xs leading-6 text-slate-200">
          {logs.map((log, index) => (
            <div key={`${index}-${log}`} className="break-all whitespace-pre-wrap">
              {log}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

