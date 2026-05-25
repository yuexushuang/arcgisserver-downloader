function normalizeKey(value) {
  return String(value || '').trim();
}

const PROXY_ENDPOINT = 'http://agsdownload.gisfun.xyz/proxy';

export function normalizeLayerUrl(inputUrl) {
  return inputUrl.replace(/\/query\/?$/i, '').replace(/\/$/, '');
}

export function normalizeServiceUrl(inputUrl) {
  return inputUrl
    .replace(/\/query\/?$/i, '')
    .replace(/\/\d+\/?$/i, '')
    .replace(/\/$/, '');
}

export function buildLayerUrl(serviceUrl, layerId) {
  return `${normalizeServiceUrl(serviceUrl)}/${layerId}`;
}

export function getServiceBaseUrl(layerUrl) {
  return layerUrl.replace(/\/\d+$/, '');
}

export function getLayerId(layerUrl) {
  const matched = layerUrl.match(/\/(\d+)$/);
  return matched ? matched[1] : '';
}

export function getMapServiceUrl(layerUrl) {
  const serviceBaseUrl = getServiceBaseUrl(layerUrl);
  return serviceBaseUrl.replace(/\/FeatureServer$/i, '/MapServer');
}

export function getQueryUrl(layerUrl) {
  return `${layerUrl}/query`;
}

export function getIdentifyUrl(serviceUrl) {
  return `${serviceUrl}/identify`;
}

export function getProxyTargetUrl() {
  return PROXY_ENDPOINT;
}

export function normalizeAuthConfig(authConfig) {
  if (!authConfig?.mode || authConfig.mode === 'none') return null;
  const name = normalizeKey(authConfig.name);
  const value = normalizeKey(authConfig.value);
  if (!name || !value) return null;
  return { mode: authConfig.mode, name, value };
}

export function buildRequestUrl(baseUrl, baseParams = {}, authConfig = null, useProxy = false) {
  const rawUrl = new URL(baseUrl);
  const mergedParams = {
    ...Object.fromEntries(rawUrl.searchParams.entries()),
    ...baseParams,
  };

  const cleanUrl = `${rawUrl.origin}${rawUrl.pathname}`;
  const requestUrl = new URL(cleanUrl);
  Object.entries(mergedParams).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      requestUrl.searchParams.set(key, value);
    }
  });

  const normalizedAuth = normalizeAuthConfig(authConfig);
  if (normalizedAuth?.mode === 'query') {
    requestUrl.searchParams.set(normalizedAuth.name, normalizedAuth.value);
  }

  return requestUrl.toString();
}

export function buildRequestOptions(authConfig = null) {
  const normalizedAuth = normalizeAuthConfig(authConfig);
  if (!normalizedAuth || normalizedAuth.mode !== 'header') return {};
  return {
    headers: {
      [normalizedAuth.name]: normalizedAuth.value,
    },
  };
}

function toProxyRequest(url, options = {}, useProxy = false) {
  if (!useProxy) return { url, options };
  return {
    url: getProxyTargetUrl(),
    options: {
      ...options,
      headers: {
        ...(options.headers || {}),
        'X-Target-URL': url,
      },
    },
  };
}

export async function fetchJson(url, options = {}, useProxy = false) {
  const request = toProxyRequest(url, options, useProxy);
  const response = await fetch(request.url, request.options);
  if (!response.ok) {
    throw new Error(`请求失败: ${response.status} ${response.statusText}`);
  }

  const json = await response.json();
  if (json?.error) {
    throw new Error(json.error.message || 'ArcGIS 服务返回错误');
  }

  return json;
}

export function getLayerExtent(layerMeta) {
  return layerMeta?.extent || layerMeta?.fullExtent || null;
}
