import React, { useState } from 'react';

function formatDomain(domain) {
  if (!domain) return '-';
  if (domain.type === 'codedValue' && Array.isArray(domain.codedValues)) {
    return `${domain.codedValues.length} 个编码值`;
  }
  return domain.name || domain.type || '已配置';
}

function toSafeValue(value) {
  if (value === null || value === undefined || value === '') return '-';
  return String(value);
}

function fallbackExecCommandCopy(text) {
  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.setAttribute('readonly', '');
  textarea.style.position = 'fixed';
  textarea.style.top = '-9999px';
  textarea.style.left = '-9999px';
  textarea.style.opacity = '0';

  document.body.appendChild(textarea);
  textarea.focus();
  textarea.select();

  let copied = false;
  try {
    copied = document.execCommand('copy');
  } catch {
    copied = false;
  }

  document.body.removeChild(textarea);
  return copied;
}

export default function LayerFieldsTable({ fields = [] }) {
  const [copyStatus, setCopyStatus] = useState('');
  const [manualCopyText, setManualCopyText] = useState('');

  const showStatus = (text) => {
    setCopyStatus(text);
    setTimeout(() => setCopyStatus(''), 2000);
  };

  const copyText = async (text, successText) => {
    if (!text) return;

    // 第一层：Clipboard API
    try {
      if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
        await navigator.clipboard.writeText(text);
        showStatus(successText);
        setManualCopyText('');
        return;
      }
    } catch {
      // 进入下一层兜底
    }

    // 第二层：execCommand
    const copiedByExecCommand = fallbackExecCommandCopy(text);
    if (copiedByExecCommand) {
      showStatus(`${successText}（兼容模式）`);
      setManualCopyText('');
      return;
    }

    // 第三层：手动复制
    setManualCopyText(text);
    showStatus('自动复制失败，请手动复制下方内容');
  };

  const copyNamesAndAliases = () => {
    const lines = fields.map((field) => `${toSafeValue(field.name)},${toSafeValue(field.alias)}`);
    copyText(lines.join('\n'), '已复制字段名和别名');
  };

  const copyAllFields = () => {
    const lines = fields.map((field) =>
      [
        toSafeValue(field.name),
        toSafeValue(field.alias),
        toSafeValue(field.type),
        toSafeValue(field.length),
        field.nullable ? '是' : '否',
        toSafeValue(formatDomain(field.domain)),
      ].join(','),
    );
    copyText(lines.join('\n'), '已复制全部字段信息');
  };

  return (
    <section className="flex min-h-0 flex-col rounded-[16px] border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-slate-800">字段信息</h2>
        <div className="flex items-center gap-2">
          {!!copyStatus && <span className="text-xs text-emerald-600">{copyStatus}</span>}
          <button
            type="button"
            onClick={copyNamesAndAliases}
            disabled={!fields.length}
            className="rounded-lg border border-slate-200 px-2 py-1 text-xs font-medium text-slate-600 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
          >
            复制字段名和别名
          </button>
          <button
            type="button"
            onClick={copyAllFields}
            disabled={!fields.length}
            className="rounded-lg border border-slate-200 px-2 py-1 text-xs font-medium text-slate-600 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
          >
            复制全部字段信息
          </button>
          <span className="rounded-full bg-sky-50 px-3 py-1 text-xs font-medium text-sky-700">{fields.length}</span>
        </div>
      </div>

      {!!manualCopyText && (
        <div className="mb-3 rounded-lg border border-amber-200 bg-amber-50 p-3">
          <p className="mb-2 text-xs text-amber-700">自动复制失败，请点击文本框后按 Ctrl+C 手动复制</p>
          <textarea
            readOnly
            value={manualCopyText}
            onFocus={(event) => event.target.select()}
            className="h-28 w-full resize-y rounded-md border border-amber-200 bg-white p-2 font-mono text-xs text-slate-700"
          />
        </div>
      )}

      {fields.length ? (
        <div className="min-h-0 flex-1 overflow-auto">
          <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
            <thead className="sticky top-0 bg-white">
              <tr className="text-slate-500">
                <th className="px-3 py-3 font-medium">字段名</th>
                <th className="px-3 py-3 font-medium">别名</th>
                <th className="px-3 py-3 font-medium">类型</th>
                <th className="px-3 py-3 font-medium">长度</th>
                <th className="px-3 py-3 font-medium">可空</th>
                <th className="px-3 py-3 font-medium">域</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {fields.map((field) => (
                <tr key={field.name} className="align-top text-slate-700">
                  <td className="px-3 py-3 font-mono text-xs">{field.name || '-'}</td>
                  <td className="px-3 py-3">{field.alias || '-'}</td>
                  <td className="px-3 py-3">{field.type || '-'}</td>
                  <td className="px-3 py-3">{field.length ?? '-'}</td>
                  <td className="px-3 py-3">{field.nullable ? '是' : '否'}</td>
                  <td className="px-3 py-3">{formatDomain(field.domain)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-5 text-sm text-slate-500">
          暂无数据
        </div>
      )}
    </section>
  );
}
