import React from 'react';
import { ChevronDown, CircleHelp, Download, Eye, Globe, Key, Layers, Link as LinkIcon, Loader2, RefreshCw, X } from 'lucide-react';

export default function LayerForm({
  serviceUrl,
  serviceUrlError,
  layerOptions,
  selectedLayerId,
  loadingLayers,
  authMode,
  authName,
  authValue,
  outSR,
  useProxy,
  loading,
  onServiceUrlChange,
  onSelectedLayerIdChange,
  onAuthModeChange,
  onAuthNameChange,
  onAuthValueChange,
  onOutSRChange,
  onUseProxyChange,
  onRefreshLayers,
  onLoadMetadata,
  onPreview,
  onDownload,
}) {
  return (
    <section className="rounded-[16px] border border-slate-200 bg-slate-50/70 p-4 shadow-sm">
      <div className="mb-5 flex items-center gap-2 text-lg font-semibold text-slate-800">
        <LinkIcon size={18} className="text-sky-600" />
        请求配置
      </div>

      <div className="space-y-5">
        <div>
          <label className="mb-2 flex items-center gap-2 text-sm font-medium text-slate-700">
            <LinkIcon size={16} className="text-sky-600" />
            服务地址
          </label>
          <input
            type="text"
            className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm shadow-inner outline-none transition focus:border-sky-400 focus:ring-4 focus:ring-sky-100"
            placeholder="https://.../MapServer"
            value={serviceUrl}
            onChange={(event) => onServiceUrlChange(event.target.value)}
            disabled={loading}
          />
          {serviceUrlError ? <p className="mt-1 text-sm text-rose-600">{serviceUrlError}</p> : null}
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <label className="mb-3 flex items-center gap-2 text-sm font-medium text-slate-700">
            <Key size={16} className="text-sky-600" />
            认证方式
          </label>
          <div className="grid gap-3 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => onAuthModeChange('query')}
              className={`rounded-xl border px-4 py-3 text-left text-sm transition ${
                authMode === 'query' ? 'border-sky-400 bg-sky-50 text-sky-700' : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
              }`}
            >
              URL 参数
            </button>
            <button
              type="button"
              onClick={() => onAuthModeChange('header')}
              className={`rounded-xl border px-4 py-3 text-left text-sm transition ${
                authMode === 'header' ? 'border-sky-400 bg-sky-50 text-sky-700' : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
              }`}
            >
              HTTP Header
            </button>
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-2 block text-xs font-medium text-slate-600">字段名</label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-sky-400 focus:ring-4 focus:ring-sky-100"
                  placeholder={authMode === 'header' ? 'X-Esri-API-Key' : 'token'}
                  value={authName}
                  onChange={(e) => onAuthNameChange(e.target.value)}
                  disabled={loading}
                />
                <button
                  type="button"
                  onClick={() => onAuthNameChange('')}
                  disabled={loading || !authName}
                  title="清空字段名"
                  className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <X size={14} />
                </button>
              </div>
            </div>
            <div>
              <label className="mb-2 block text-xs font-medium text-slate-600">字段值</label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-sky-400 focus:ring-4 focus:ring-sky-100"
                  placeholder="请输入"
                  value={authValue}
                  onChange={(e) => onAuthValueChange(e.target.value)}
                  disabled={loading}
                />
                <button
                  type="button"
                  onClick={() => onAuthValueChange('')}
                  disabled={loading || !authValue}
                  title="清空字段值"
                  className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <X size={14} />
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="relative w-full">
            <select
              className="w-full appearance-none rounded-xl border border-slate-200 bg-white px-4 py-3 pr-10 text-sm outline-none transition focus:border-sky-400 focus:ring-4 focus:ring-sky-100"
              value={selectedLayerId}
              onChange={(event) => onSelectedLayerIdChange(event.target.value)}
              disabled={loading || loadingLayers || !layerOptions.length}
            >
              <option value="">{loadingLayers ? '正在加载图层...' : '请选择图层'}</option>
              {layerOptions.map((item) => (
                <option key={item.id} value={String(item.id)}>
                  {item.name || `图层 ${item.id}`}
                </option>
              ))}
            </select>
            <ChevronDown size={16} className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-slate-400" />
          </div>
          <button
            type="button"
            onClick={onRefreshLayers}
            disabled={loading || loadingLayers || !serviceUrl.trim()}
            title="刷新图层列表"
            className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loadingLayers ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
          </button>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-2">
          <label className="flex items-center justify-between gap-4">
            <span className="flex items-center gap-2 text-sm font-medium text-slate-700">
              <Globe size={16} className="text-sky-600" />
              使用代理
            </span>
            <button
              type="button"
              onClick={() => onUseProxyChange(!useProxy)}
              disabled={loading}
              className={`relative inline-flex h-7 w-14 items-center rounded-full transition ${
                useProxy ? 'bg-sky-600' : 'bg-slate-300'
              }`}
            >
              <span className={`inline-block h-5 w-5 rounded-full bg-white transition ${useProxy ? 'translate-x-8' : 'translate-x-1'}`} />
            </button>
          </label>
        </div>

        <div>
          <label className="mb-2 flex items-center gap-2 text-sm font-medium text-slate-700">
            <Globe size={16} className="text-sky-600" />
            输出坐标系
            <span className="inline-flex items-center text-slate-400" title="输入的EPSG编码" aria-label="输入的EPSG编码">
              <CircleHelp size={14} />
            </span>
          </label>
          <input
            type="text"
            className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-mono shadow-inner outline-none transition focus:border-sky-400 focus:ring-4 focus:ring-sky-100"
            placeholder="例如 4326 或 3857"
            value={outSR}
            onChange={(event) => onOutSRChange(event.target.value)}
            disabled={loading}
          />
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <button
            type="button"
            onClick={onLoadMetadata}
            disabled={loading}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-3 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            {loading ? <Loader2 size={18} className="animate-spin" /> : <LinkIcon size={18} />}
            加载图层信息
          </button>
          <button
            type="button"
            onClick={onPreview}
            disabled={loading}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-3 text-sm font-medium text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            <Eye size={18} />
            图层预览
          </button>
          <button
            type="button"
            onClick={onDownload}
            disabled={loading}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-sky-600 px-4 py-3 text-sm font-medium text-white transition hover:bg-sky-700 disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            {loading ? <Loader2 size={18} className="animate-spin" /> : <Download size={18} />}
            下载 GeoJSON
          </button>
        </div>
      </div>
    </section>
  );
}
