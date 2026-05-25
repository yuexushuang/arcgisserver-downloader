import React, { useEffect, useMemo, useRef, useState } from 'react';
import { CheckCircle2, ChevronUp, Database, MessageCircleMore, X } from 'lucide-react';
import LayerForm from './components/LayerForm';
import MetadataPanel from './components/MetadataPanel';
import LayerFieldsTable from './components/LayerFieldsTable';
import MapPreview from './components/MapPreview';
import LogPanel from './components/LogPanel';
import {
  buildLayerUrl,
  buildRequestOptions,
  buildRequestUrl,
  fetchJson,
  getLayerExtent,
  getLayerId,
  getMapServiceUrl,
  getQueryUrl,
  normalizeServiceUrl,
} from './utils/arcgis';

function buildDownloadName(layerMeta) {
  const rawName = layerMeta?.name || 'arcgis_layer_data';
  return rawName.replace(/[\\/:*?"<>|]/g, '_');
}

function getLayerSummary(layerMeta, totalCount) {
  if (!layerMeta) return [];
  const extent = layerMeta.extent || layerMeta.fullExtent;
  const extentText =
    extent && [extent.xmin, extent.ymin, extent.xmax, extent.ymax].every((v) => typeof v === 'number')
      ? `${extent.xmin}, ${extent.ymin}, ${extent.xmax}, ${extent.ymax}`
      : '-';

  return [
    { label: '图层名称', value: layerMeta.name || '-' },
    { label: '几何类型', value: layerMeta.geometryType || '-' },
    {
      label: '空间参考',
      value: layerMeta.extent?.spatialReference?.wkid || layerMeta.sourceSpatialReference?.wkid || '-',
    },
    { label: '图层范围', value: extentText },
    { label: '最大记录数', value: layerMeta.maxRecordCount || '-' },
    { label: '要素总数', value: totalCount ?? '-' },
  ];
}

function buildAuthConfig(authMode, authName, authValue) {
  if (authMode === 'none') return { mode: 'none' };
  if (!authMode) return { mode: 'none' };
  return {
    mode: authMode,
    name: authName.trim(),
    value: authValue.trim(),
  };
}

export default function App() {
  const [serviceUrl, setServiceUrl] = useState('');
  const [serviceUrlError, setServiceUrlError] = useState('');
  const [layerOptions, setLayerOptions] = useState([]);
  const [selectedLayerId, setSelectedLayerId] = useState('');
  const [loadingLayers, setLoadingLayers] = useState(false);

  const [authMode, setAuthMode] = useState('query');
  const [authName, setAuthName] = useState('');
  const [authValue, setAuthValue] = useState('');

  const [outSR, setOutSR] = useState('4326');
  const [useProxy, setUseProxy] = useState(false);
  const [status, setStatus] = useState('idle');
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [logs, setLogs] = useState([]);
  const [layerMeta, setLayerMeta] = useState(null);
  const [totalCount, setTotalCount] = useState(null);
  const [mapConfig, setMapConfig] = useState(null);
  const [activeTab, setActiveTab] = useState('metadata');
  const [showPreviewPanel, setShowPreviewPanel] = useState(false);
  const [logsCollapsed, setLogsCollapsed] = useState(false);
  const [showContactModal, setShowContactModal] = useState(false);
  const logRef = useRef(null);

  const authConfig = useMemo(() => buildAuthConfig(authMode, authName, authValue), [authMode, authName, authValue]);

  const addLog = (message) => {
    setLogs((prev) => [...prev, `[${new Date().toLocaleTimeString()}] ${message}`]);
  };

  const resetLayerState = () => {
    setLayerMeta(null);
    setTotalCount(null);
    setMapConfig(null);
    setProgress({ current: 0, total: 0 });
  };

  const loadServiceLayers = async (nextServiceUrl) => {
    if (!nextServiceUrl.trim()) {
      setLayerOptions([]);
      setSelectedLayerId('');
      return;
    }

    const normalizedServiceUrl = normalizeServiceUrl(nextServiceUrl.trim());
    setLoadingLayers(true);
    try {
      const serviceInfo = await fetchJson(
        buildRequestUrl(normalizedServiceUrl, { f: 'json' }, authConfig, useProxy),
        buildRequestOptions(authConfig),
        useProxy,
      );
      const layers = Array.isArray(serviceInfo?.layers) ? serviceInfo.layers : [];
      setLayerOptions(layers);
      setSelectedLayerId((prev) => (prev && layers.some((item) => String(item.id) === prev) ? prev : String(layers[0]?.id ?? '')));
    } catch {
      setLayerOptions([]);
      setSelectedLayerId('');
    } finally {
      setLoadingLayers(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      loadServiceLayers(serviceUrl);
    }, 300);
    return () => clearTimeout(timer);
  }, [serviceUrl, authMode, authName, authValue, useProxy]);

  const resolveRequestContext = () => {
    if (!serviceUrl.trim()) {
      throw new Error('请输入服务地址');
    }
    if (!selectedLayerId) {
      throw new Error('请选择图层');
    }

    const normalizedServiceUrl = normalizeServiceUrl(serviceUrl.trim());
    const layerUrl = buildLayerUrl(normalizedServiceUrl, selectedLayerId);
    const mapServiceUrl = getMapServiceUrl(layerUrl);
    return { layerUrl, mapServiceUrl };
  };

  const ensureInputs = () => {
    if (!serviceUrl.trim()) {
      setServiceUrlError('请输入服务地址');
      return false;
    }
    if (!selectedLayerId) {
      setServiceUrlError('请选择图层');
      return false;
    }
    setServiceUrlError('');
    return true;
  };

  const loadLayerMetadata = async () => {
    if (!ensureInputs()) return;

    try {
      setStatus('loading');
      setLogs([]);
      resetLayerState();

      const { layerUrl, mapServiceUrl } = resolveRequestContext();
      addLog(`开始读取图层信息: ${layerUrl}`);

      const layerInfo = await fetchJson(
        buildRequestUrl(layerUrl, { f: 'json' }, authConfig, useProxy),
        buildRequestOptions(authConfig),
        useProxy,
      );
      addLog(`图层信息加载完成: ${layerInfo.name || '未命名图层'}`);

      const countData = await fetchJson(
        buildRequestUrl(getQueryUrl(layerUrl), { where: '1=1', returnCountOnly: 'true', f: 'json' }, authConfig, useProxy),
        buildRequestOptions(authConfig),
        useProxy,
      );
      addLog(`要素总数统计完成: ${countData.count ?? 0}`);

      setLayerMeta(layerInfo);
      setTotalCount(countData.count ?? 0);
      setMapConfig({
        layerUrl,
        layerId: getLayerId(layerUrl) || String(layerInfo.id ?? ''),
        mapServiceUrl,
        extent: getLayerExtent(layerInfo),
        authConfig,
        useProxy,
      });
      setActiveTab('metadata');
      setShowPreviewPanel(true);
      setStatus('success');
    } catch (error) {
      addLog(`错误: ${error.message}`);
      setStatus('error');
    }
  };

  const handleDownload = async () => {
    if (!ensureInputs()) return;

    try {
      setStatus('loading');
      setProgress({ current: 0, total: 0 });
      const { layerUrl } = resolveRequestContext();
      const currentLayerMeta =
        layerMeta ??
        (await fetchJson(
          buildRequestUrl(layerUrl, { f: 'json' }, authConfig, useProxy),
          buildRequestOptions(authConfig),
          useProxy,
        ));
      const layerName = buildDownloadName(currentLayerMeta);
      const maxRecordCount = Math.min(currentLayerMeta.maxRecordCount || 1000, 1000);

      const countData = await fetchJson(
        buildRequestUrl(getQueryUrl(layerUrl), { where: '1=1', returnCountOnly: 'true', f: 'json' }, authConfig, useProxy),
        buildRequestOptions(authConfig),
        useProxy,
      );
      const recordCount = countData.count ?? 0;
      setProgress({ current: 0, total: recordCount });
      if (!recordCount) {
        setStatus('success');
        return;
      }

      const features = [];
      const pageCount = Math.ceil(recordCount / maxRecordCount);
      for (let pageIndex = 0; pageIndex < pageCount; pageIndex += 1) {
        const resultOffset = pageIndex * maxRecordCount;
        const queryResult = await fetchJson(
          buildRequestUrl(
            getQueryUrl(layerUrl),
            {
              where: '1=1',
              outFields: '*',
              outSR: outSR || '4326',
              f: 'geojson',
              resultOffset: String(resultOffset),
              resultRecordCount: String(maxRecordCount),
            },
            authConfig,
            useProxy,
          ),
          buildRequestOptions(authConfig),
          useProxy,
        );
        if (queryResult.type === 'FeatureCollection') {
          features.push(...(queryResult.features || []));
        }
        setProgress({ current: Math.min(resultOffset + maxRecordCount, recordCount), total: recordCount });
      }

      const geojson = {
        type: 'FeatureCollection',
        name: layerName,
        crs: { type: 'name', properties: { name: `urn:ogc:def:crs:EPSG::${outSR || '4326'}` } },
        features,
      };
      const blob = new Blob([JSON.stringify(geojson, null, 2)], { type: 'application/geo+json' });
      const downloadUrl = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = downloadUrl;
      anchor.download = `${layerName}.geojson`;
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
      URL.revokeObjectURL(downloadUrl);
      setStatus('success');
    } catch (error) {
      addLog(`错误: ${error.message}`);
      setStatus('error');
    }
  };

  const handleOpenPreview = async () => {
    if (!ensureInputs()) return;

    try {
      const { layerUrl, mapServiceUrl } = resolveRequestContext();
      const previewLayerMeta =
        layerMeta ??
        (await fetchJson(
          buildRequestUrl(layerUrl, { f: 'json' }, authConfig, useProxy),
          buildRequestOptions(authConfig),
          useProxy,
        ));

      setMapConfig((prev) => ({
        layerUrl,
        layerId: getLayerId(layerUrl) || String(previewLayerMeta?.id ?? prev?.layerId ?? ''),
        mapServiceUrl,
        extent: getLayerExtent(previewLayerMeta) || prev?.extent || null,
        authConfig,
        useProxy,
      }));
      setActiveTab('preview');
      setShowPreviewPanel(true);
    } catch (error) {
      addLog(`错误: ${error.message}`);
      setStatus('error');
    }
  };

  const layerSummary = useMemo(() => getLayerSummary(layerMeta, totalCount), [layerMeta, totalCount]);
  const showWorkspace = showPreviewPanel;
  const showLogs = Boolean(logs.length || status !== 'idle');

  return (
    <div className="h-screen w-screen overflow-hidden bg-slate-100 p-2 text-slate-800">
      <section className="flex h-full w-full flex-col overflow-hidden rounded-[18px] border border-slate-200 bg-white shadow-[0_16px_48px_rgba(15,23,42,0.1)]">
        <div className="flex shrink-0 flex-col gap-2 bg-linear-to-r from-cyan-700 via-sky-700 to-blue-800 px-5 py-3 text-white">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="rounded-2xl bg-white/15 p-3 ring-1 ring-white/20 backdrop-blur">
                <Database size={28} />
              </div>
              <h1 className="text-xl font-semibold tracking-tight">ArcGIS 图层分析与导出工具</h1>
            </div>
            <button
              type="button"
              onClick={() => setShowContactModal(true)}
              className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-white/20 bg-white/10 text-white transition hover:bg-white/20"
              title="联系我"
              aria-label="联系我"
            >
              <MessageCircleMore size={18} />
            </button>
          </div>
        </div>

        <div className="flex min-h-0 flex-1 flex-col gap-4 p-4">
          <div className={`grid min-h-0 flex-1 gap-4 ${showWorkspace || showLogs ? 'xl:grid-cols-[420px_minmax(0,1fr)]' : ''}`}>
            <div className={`min-h-0 overflow-y-auto pr-1 ${showWorkspace || showLogs ? '' : 'mx-auto w-full max-w-[560px]'}`}>
              <LayerForm
                serviceUrl={serviceUrl}
                serviceUrlError={serviceUrlError}
                layerOptions={layerOptions}
                selectedLayerId={selectedLayerId}
                loadingLayers={loadingLayers}
                authMode={authMode}
                authName={authName}
                authValue={authValue}
                outSR={outSR}
                useProxy={useProxy}
                loading={status === 'loading'}
                onServiceUrlChange={(nextUrl) => {
                  setServiceUrl(nextUrl);
                  if (serviceUrlError && nextUrl.trim()) setServiceUrlError('');
                }}
                onSelectedLayerIdChange={setSelectedLayerId}
                onAuthModeChange={setAuthMode}
                onAuthNameChange={setAuthName}
                onAuthValueChange={setAuthValue}
                onOutSRChange={setOutSR}
                onUseProxyChange={setUseProxy}
                onRefreshLayers={() => loadServiceLayers(serviceUrl)}
                onLoadMetadata={loadLayerMetadata}
                onPreview={handleOpenPreview}
                onDownload={handleDownload}
              />
            </div>

            {showWorkspace ? (
              <section className="min-h-0 overflow-hidden rounded-[16px] border border-slate-200 bg-white shadow-sm">
                <div className="flex h-full min-h-0 flex-col">
                  <div className="border-b border-slate-200 px-4 py-3">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setActiveTab('metadata')}
                        className={`rounded-xl px-4 py-2 text-sm font-medium transition ${
                          activeTab === 'metadata' ? 'bg-sky-100 text-sky-700' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-800'
                        }`}
                      >
                        图层信息
                      </button>
                      <button
                        type="button"
                        onClick={() => setActiveTab('preview')}
                        className={`rounded-xl px-4 py-2 text-sm font-medium transition ${
                          activeTab === 'preview' ? 'bg-sky-100 text-sky-700' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-800'
                        }`}
                      >
                        图层预览
                      </button>
                    </div>
                  </div>
                  <div className="min-h-0 flex-1 overflow-y-auto p-4">
                    {activeTab === 'metadata' ? (
                      <div className="space-y-4">
                        <MetadataPanel title="图层元数据" icon={<CheckCircle2 size={18} className="text-emerald-600" />} items={layerSummary} emptyText="暂无数据" />
                        <LayerFieldsTable fields={layerMeta?.fields || []} />
                      </div>
                    ) : (
                      <MapPreview mapConfig={mapConfig} layerMeta={layerMeta} />
                    )}
                  </div>
                </div>
              </section>
            ) : (
              <div />
            )}
          </div>

          {showLogs ? (
            logsCollapsed ? (
              <div className="flex items-center justify-end">
                <button
                  type="button"
                  onClick={() => setLogsCollapsed(false)}
                  className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-600 transition hover:bg-slate-100"
                >
                  <ChevronUp size={14} />
                  展开执行日志
                </button>
              </div>
            ) : (
              <div className="min-h-0">
                <LogPanel logs={logs} progress={progress} status={status} logRef={logRef} collapsed={logsCollapsed} onToggleCollapse={() => setLogsCollapsed((prev) => !prev)} />
              </div>
            )
          ) : null}
        </div>
      </section>

      {showContactModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-slate-800">联系我</h2>
              <button
                type="button"
                onClick={() => setShowContactModal(false)}
                className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-500 transition hover:bg-slate-100 hover:text-slate-700"
                title="关闭"
                aria-label="关闭"
              >
                <X size={16} />
              </button>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <img
                src="/wechat-qrcode.png"
                alt="微信公众号二维码"
                className="mx-auto h-56 w-56 rounded-lg border border-slate-200 bg-white object-contain p-2"
              />
              <img
                src="/wechat-search.png"
                alt="微信公众号二维码"
                className="mx-auto rounded-lg border border-slate-200 bg-white object-contain p-2 mt-4"
              />
              
              <p>
                使用过程中如果遇到问题，欢迎关注我的微信公众号【GIS探索发现】并给我留言。
                或者你有什么GIS相关问题，也可以联系我帮助你解决。                
              </p>              
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
