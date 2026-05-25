import React from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';
import 'ol/ol.css';
import Map from 'ol/Map';
import View from 'ol/View';
import TileLayer from 'ol/layer/Tile';
import ImageLayer from 'ol/layer/Image';
import XYZ from 'ol/source/XYZ';
import ImageArcGISRest from 'ol/source/ImageArcGISRest';
import Overlay from 'ol/Overlay';
import { defaults as defaultControls } from 'ol/control';
import { fromLonLat, get as getProjection, transformExtent } from 'ol/proj';
import {
  buildRequestOptions,
  buildRequestUrl,
  fetchJson,
  getIdentifyUrl,
  getProxyTargetUrl,
  getQueryUrl,
} from '../utils/arcgis';

function createPopupContent(attributes) {
  const entries = Object.entries(attributes || {}).slice(0, 12);
  if (!entries.length) return '<div class="ol-popup-empty">暂无数据</div>';
  return entries
    .map(
      ([key, value]) =>
        `<div class="ol-popup-row"><span class="ol-popup-key">${key}</span><span class="ol-popup-value">${value ?? '-'}</span></div>`,
    )
    .join('');
}

function toExtent(extent) {
  if (!extent) return null;
  const { xmin, ymin, xmax, ymax } = extent;
  if ([xmin, ymin, xmax, ymax].some((item) => typeof item !== 'number')) return null;
  return [xmin, ymin, xmax, ymax];
}

function toArcGisExtentParam(extent) {
  if (!Array.isArray(extent) || extent.length !== 4) return '';
  return extent.join(',');
}

function resolveExtentProjection(extent, fallbackWkid) {
  const wkid = extent?.spatialReference?.latestWkid || extent?.spatialReference?.wkid || fallbackWkid;
  if (!wkid) return 'EPSG:3857';
  if ([3857, 102100, 102113, 900913].includes(Number(wkid))) return 'EPSG:3857';
  if (Number(wkid) === 4326 || Number(wkid) === 4490) return 'EPSG:4326';
  const projectionCode = `EPSG:${wkid}`;
  return getProjection(projectionCode) ? projectionCode : null;
}

function buildLayerParams(customParams) {
  return (customParams || []).reduce((result, item) => {
    const key = item?.key?.trim();
    if (!key) return result;
    return { ...result, [key]: item?.value?.trim?.() ?? item?.value ?? '' };
  }, {});
}

function getTiandituToken(customParams) {
  const params = customParams || [];
  const tokenItem = params.find((item) => {
    const key = item?.key?.trim()?.toLowerCase();
    return key === 'tdttk' || key === 'tianditutik' || key === 'tdt_token' || key === 'tk';
  });
  const fromCustomParams = tokenItem?.value?.trim?.() || '';
  const fromEnv = import.meta.env.VITE_TDT_TK?.trim?.() || '';
  return fromCustomParams || fromEnv;
}

function buildTiandituUrl(layerType, token) {
  const base = `https://t{0-7}.tianditu.gov.cn/${layerType}_w/wmts`;
  const query =
    'SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&LAYER=' +
    layerType +
    '&STYLE=default&TILEMATRIXSET=w&FORMAT=tiles&TILEMATRIX={z}&TILEROW={y}&TILECOL={x}';
  return token ? `${base}?${query}&tk=${token}` : `${base}?${query}`;
}

function looksLikeLonLatExtent(extent) {
  if (!Array.isArray(extent) || extent.length !== 4) return false;
  const [xmin, ymin, xmax, ymax] = extent;
  return Math.abs(xmin) <= 180 && Math.abs(xmax) <= 180 && Math.abs(ymin) <= 90 && Math.abs(ymax) <= 90;
}

function getSafeViewExtent(extent, sourceProjection) {
  if (!extent) return null;
  if (!sourceProjection) {
    if (looksLikeLonLatExtent(extent)) return transformExtent(extent, 'EPSG:4326', 'EPSG:3857');
    return extent;
  }
  if (sourceProjection === 'EPSG:3857') return extent;
  try {
    return transformExtent(extent, sourceProjection, 'EPSG:3857');
  } catch {
    if (looksLikeLonLatExtent(extent)) {
      return transformExtent(extent, 'EPSG:4326', 'EPSG:3857');
    }
    return null;
  }
}

function fitToLayerExtent(map, mapConfig, layerMeta) {
  if (!map || !mapConfig) return;
  const fitExtent = toExtent(mapConfig.extent);
  if (!fitExtent) return;
  const sourceProjection = resolveExtentProjection(mapConfig.extent, layerMeta?.sourceSpatialReference?.wkid);
  const transformedExtent = getSafeViewExtent(fitExtent, sourceProjection);
  if (!transformedExtent) return;
  map.getView().fit(transformedExtent, {
    padding: [40, 40, 40, 40],
    maxZoom: 16,
    duration: 300,
  });
}

function applyAuthToFetchOptions(url, authConfig) {
  const normalized = authConfig?.mode === 'header' && authConfig.name && authConfig.value ? authConfig : null;
  if (!normalized) return { url, options: {} };
  return {
    url,
    options: {
      headers: {
        [normalized.name]: normalized.value,
      },
    },
  };
}

function appendAuthQueryToUrl(url, authConfig) {
  const normalized = authConfig?.mode === 'query' && authConfig.name && authConfig.value ? authConfig : null;
  if (!normalized) return url;
  try {
    const parsed = new URL(url);
    parsed.searchParams.set(normalized.name, normalized.value);
    return parsed.toString();
  } catch {
    return url;
  }
}

export default function MapPreview({ mapConfig, layerMeta }) {
  const mapElementRef = useRef(null);
  const popupElementRef = useRef(null);
  const mapRef = useRef(null);
  const arcgisLayerRef = useRef(null);
  const popupOverlayRef = useRef(null);
  const [popupTitle, setPopupTitle] = useState('地图加载中');
  const [popupHtml, setPopupHtml] = useState('点击地图后显示要素属性');
  const closePopup = () => {
    popupOverlayRef.current?.setPosition(undefined);
  };

  const queryFieldName = useMemo(
    () => layerMeta?.displayField || layerMeta?.objectIdField || layerMeta?.objectIdFieldName || '',
    [layerMeta],
  );

  useEffect(() => {
    if (!mapElementRef.current || mapRef.current) return undefined;

    const popupOverlay = new Overlay({
      element: popupElementRef.current,
      positioning: 'bottom-center',
      offset: [0, -16],
      stopEvent: true,
      autoPan: {
        animation: { duration: 200 },
        margin: 20,
      },
    });
    popupOverlayRef.current = popupOverlay;

    const tdtToken = getTiandituToken(mapConfig?.customParams);
    const map = new Map({
      target: mapElementRef.current,
      layers: [
        new TileLayer({
          source: new XYZ({
            url: buildTiandituUrl('vec', tdtToken),
            crossOrigin: 'anonymous',
          }),
        }),
        new TileLayer({
          source: new XYZ({
            url: buildTiandituUrl('cva', tdtToken),
            crossOrigin: 'anonymous',
          }),
        }),
      ],
      overlays: [popupOverlay],
      controls: defaultControls({ attribution: false, rotate: false, zoom: true }),
      view: new View({
        center: fromLonLat([105, 35]),
        zoom: 4,
      }),
    });

    mapRef.current = map;
    return () => {
      map.setTarget(undefined);
      mapRef.current = null;
    };
  }, [mapConfig?.customParams]);

  useEffect(() => {
    if (!mapRef.current || !mapConfig) return;

    if (arcgisLayerRef.current) {
      mapRef.current.removeLayer(arcgisLayerRef.current);
      arcgisLayerRef.current = null;
    }

    const imageLayer = new ImageLayer({
      source: new ImageArcGISRest({
        ratio: 1,
        crossOrigin: 'anonymous',
        url: mapConfig.mapServiceUrl,
        params: {
          FORMAT: 'png32',
          TRANSPARENT: true,
          ...(mapConfig.layerId ? { LAYERS: `show:${mapConfig.layerId}` } : {}),
          ...buildLayerParams(mapConfig.customParams),
        },
        imageLoadFunction: (image, src) => {
          const srcWithAuth = appendAuthQueryToUrl(src, mapConfig.authConfig);
          const authHeaders = applyAuthToFetchOptions(srcWithAuth, mapConfig.authConfig).options.headers || {};
          const requestUrl = mapConfig.useProxy ? getProxyTargetUrl() : srcWithAuth;
          const requestOptions = mapConfig.useProxy
            ? {
                headers: {
                  ...authHeaders,
                  'X-Target-URL': srcWithAuth,
                },
              }
            : { headers: authHeaders };

          fetch(requestUrl, requestOptions)
            .then((response) => response.blob())
            .then((blob) => {
              image.getImage().src = URL.createObjectURL(blob);
            });
        },
      }),
    });

    arcgisLayerRef.current = imageLayer;
    mapRef.current.addLayer(imageLayer);
    mapRef.current.updateSize();
    requestAnimationFrame(() => {
      mapRef.current?.updateSize();
      fitToLayerExtent(mapRef.current, mapConfig, layerMeta);
    });
  }, [layerMeta, mapConfig]);

  useEffect(() => {
    if (!mapRef.current || !mapConfig || !popupOverlayRef.current) return undefined;

    const handleClick = async (event) => {
      try {
        const view = mapRef.current.getView();
        const projectionCode = view.getProjection().getCode().replace('EPSG:', '');
        const viewExtent = view.calculateExtent(mapRef.current.getSize());
        const [x, y] = event.coordinate;

        const identifyUrl = buildRequestUrl(
          getIdentifyUrl(mapConfig.mapServiceUrl),
          {
            f: 'json',
            tolerance: '6',
            returnGeometry: 'false',
            imageDisplay: '1200,800,96',
            geometryType: 'esriGeometryPoint',
            geometry: `${x},${y}`,
            mapExtent: toArcGisExtentParam(viewExtent),
            sr: projectionCode,
            ...(mapConfig.layerId ? { layers: `visible:${mapConfig.layerId}` } : {}),
          },
          mapConfig.authConfig,
          mapConfig.useProxy,
        );

        const identifyOptions = buildRequestOptions(mapConfig.authConfig);
        const identifyResult = await fetchJson(identifyUrl, identifyOptions, mapConfig.useProxy).catch(() => null);
        let attributes = identifyResult?.results?.[0]?.attributes || null;
        const title = identifyResult?.results?.[0]?.layerName || '鐐瑰嚮鏌ヨ缁撴灉';

        if (!attributes) {
          return;
        }

        setPopupTitle(attributes[queryFieldName] || title || '要素信息');
        setPopupHtml(createPopupContent(attributes));
        popupOverlayRef.current.setPosition(event.coordinate);
      } catch (error) {
        setPopupTitle('加载中');
        setPopupHtml(`加载失败: ${error.message}`);
        popupOverlayRef.current.setPosition(event.coordinate);
      }
    };

    mapRef.current.on('singleclick', handleClick);
    return () => {
      mapRef.current?.un('singleclick', handleClick);
    };
  }, [mapConfig, queryFieldName]);

  useEffect(() => {
    if (!mapRef.current || !mapConfig) return;
    const timer = setTimeout(() => {
      mapRef.current?.updateSize();
      fitToLayerExtent(mapRef.current, mapConfig, layerMeta);
    }, 0);
    return () => clearTimeout(timer);
  }, [mapConfig?.layerUrl, mapConfig?.layerId]);

  return (
    <section className="flex h-full min-h-0 flex-col">
      <div className="relative min-h-0 flex-1 overflow-hidden rounded-[14px] border border-slate-200 bg-slate-100">
        <div ref={mapElementRef} className="h-full min-h-[520px] w-full xl:min-h-0" />
        <div className="absolute top-3 right-3 z-10">
          <button
            type="button"
            onClick={() => fitToLayerExtent(mapRef.current, mapConfig, layerMeta)}
            className="inline-flex items-center rounded-lg border border-slate-200 bg-white/95 px-3 py-2 text-xs font-medium text-slate-700 shadow-sm transition hover:bg-white"
          >
            缩放到图层范围
          </button>
        </div>
        <div ref={popupElementRef} className="ol-popup">
          <div className="ol-popup-card">
            <div className="ol-popup-title">
              <span className="ol-popup-title-text">{popupTitle}</span>
              <button type="button" className="ol-popup-close" onClick={closePopup} aria-label="关闭浮窗">
                ×
              </button>
            </div>
            <div className="ol-popup-content" dangerouslySetInnerHTML={{ __html: popupHtml }} />
          </div>
        </div>
        {!mapConfig && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-slate-950/10 backdrop-blur-[2px]">
            <div className="rounded-xl bg-white/90 px-6 py-4 text-sm text-slate-600 shadow-lg">地图加载中...</div>
          </div>
        )}
      </div>
    </section>
  );
}

