import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

function parseProxyHeaders(reqUrl) {
  const requestUrl = new URL(reqUrl, 'http://127.0.0.1');
  const encoded = requestUrl.searchParams.get('x-proxy-headers');
  if (!encoded) return {};

  try {
    const parsed = JSON.parse(decodeURIComponent(encoded));
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

export default defineConfig({
  plugins: [
    react(),
    {
      name: 'local-proxy-endpoint',
      configureServer(server) {
        server.middlewares.use('/proxy', async (req, res) => {
          const requestUrl = new URL(req.url, 'http://127.0.0.1');
          const target = requestUrl.searchParams.get('url');

          if (!target) {
            res.statusCode = 400;
            res.setHeader('Content-Type', 'application/json; charset=utf-8');
            res.end(JSON.stringify({ error: { message: '缺少 url 参数' } }));
            return;
          }

          try {
            const headers = parseProxyHeaders(req.url || '');
            const upstream = await fetch(target, { headers });
            const contentType = upstream.headers.get('content-type') || 'application/octet-stream';
            const buffer = Buffer.from(await upstream.arrayBuffer());

            res.statusCode = upstream.status;
            res.setHeader('Content-Type', contentType);
            res.setHeader('Access-Control-Allow-Origin', '*');
            res.end(buffer);
          } catch (error) {
            res.statusCode = 502;
            res.setHeader('Content-Type', 'application/json; charset=utf-8');
            res.end(JSON.stringify({ error: { message: error.message } }));
          }
        });
      },
    },
  ],
});
