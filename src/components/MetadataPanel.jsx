import React from 'react';
export default function MetadataPanel({ title, icon, items = [], emptyText = '加载中' }) {
  return (
    <section className="rounded-[16px] border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-4 flex items-center gap-2 text-base font-semibold text-slate-800">
        {icon}
        {title}
      </div>

      {items.length ? (
        <div className="grid gap-3">
          {items.map((item) => (
            <div key={item.label} className="rounded-xl border border-slate-100 bg-slate-50 px-4 py-3">
              <div className="text-xs uppercase tracking-[0.18em] text-slate-400">{item.label}</div>
              <div className="mt-1 break-all text-sm font-medium text-slate-700">{String(item.value ?? '-')}</div>
            </div>
          ))}
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-5 text-sm text-slate-500">
          {emptyText}
        </div>
      )}
    </section>
  );
}

