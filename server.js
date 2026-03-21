import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { join, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createVerify } from 'node:crypto';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const DIST = join(__dirname, 'dist');
const PORT = process.env.PORT || 3000;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.wasm': 'application/wasm',
  '.woff2': 'font/woff2',
};

// Helper: check if a hostname is in a private IP range (SSRF protection)
function isPrivateIp(hostname) {
  const ip = hostname.toLowerCase();
  if (ip === 'localhost' || ip === '127.0.0.1' || ip === '::1' || ip === '0.0.0.0') return true;
  if (ip.startsWith('127.')) return true;
  if (ip.startsWith('10.')) return true;
  if (ip.startsWith('172.') && ip.split('.')[1] >= 16 && ip.split('.')[1] <= 31) return true;
  if (ip.startsWith('192.168.')) return true;
  if (ip.startsWith('::ffff:127.')) return true; // IPv6 localhost
  if (ip.startsWith('fc00:') || ip.startsWith('fd00:')) return true; // IPv6 private
  return false;
}

// Helper: validate Supabase JWT locally using its public key
// (Note: This is a simplified version; for production, fetch public keys from jwks URL)
function validateSupabaseJwt(token, jwtSecret) {
  if (!jwtSecret) return true; // No secret set, skip JWT validation
  if (!token) return false;

  try {
    // Remove 'Bearer ' prefix if present
    const actualToken = token.startsWith('Bearer ') ? token.slice(7) : token;
    const parts = actualToken.split('.');
    if (parts.length !== 3) return false;

    // Verify signature: base64url(header).base64url(payload) with HMAC-SHA256
    const header = JSON.parse(Buffer.from(parts[0], 'base64').toString());
    const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString());
    const signature = parts[2];

    // Simple HMAC-SHA256 verification
    const verify = createVerify('sha256');
    verify.update(`${parts[0]}.${parts[1]}`);
    const decoded = Buffer.from(signature, 'base64');
    const isValid = verify.verify(jwtSecret, decoded);
    return isValid;
  } catch (err) {
    console.warn('JWT validation error:', err.message);
    return false;
  }
}

async function handlePostgisSchema(req, res) {
  const allowedOrigin = process.env.APP_ORIGIN || req.headers.origin || '';
  res.setHeader('Access-Control-Allow-Origin', allowedOrigin);
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') { res.writeHead(200); res.end(); return; }
  if (req.method !== 'POST') { res.writeHead(405).end(); return; }

  try {
    // Check JWT if SUPABASE_JWT_SECRET is set
    if (process.env.SUPABASE_JWT_SECRET) {
      const authHeader = req.headers.authorization || '';
      if (!validateSupabaseJwt(authHeader, process.env.SUPABASE_JWT_SECRET)) {
        res.writeHead(401, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Unauthorized' }));
        return;
      }
    }

    // Parse request body
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    const { connectionString, schema } = JSON.parse(Buffer.concat(chunks).toString());

    if (!connectionString) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'connectionString is required' }));
      return;
    }

    // SSRF protection: check hostname
    try {
      const url = new URL(connectionString.includes('://') ? connectionString : `postgresql://${connectionString}`);
      if (isPrivateIp(url.hostname)) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Private IP addresses are not allowed' }));
        return;
      }
    } catch {
      // If we can't parse the connection string, try simple pattern matching
      if (isPrivateIp(connectionString.split('@')[1]?.split(':')[0] || connectionString)) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Private IP addresses are not allowed' }));
        return;
      }
    }

    // Dynamically import pg (node-postgres)
    const { Pool } = await import('pg');
    const targetSchema = schema || 'public';

    const pool = new Pool({ connectionString });

    try {
      // Query information_schema
      const query = `
        SELECT
          c.table_name,
          c.column_name,
          c.data_type,
          c.udt_name,
          c.is_nullable,
          c.column_default,
          tc.constraint_type
        FROM information_schema.columns c
        LEFT JOIN information_schema.key_column_usage kcu
          ON c.table_schema = kcu.table_schema
          AND c.table_name = kcu.table_name
          AND c.column_name = kcu.column_name
        LEFT JOIN information_schema.table_constraints tc
          ON kcu.constraint_name = tc.constraint_name
          AND kcu.table_schema = tc.table_schema
        WHERE c.table_schema = $1
        ORDER BY c.table_name, c.ordinal_position
      `;

      const result = await pool.query(query, [targetSchema]);
      const rows = result.rows;

      // Group by table and return in the same format as Supabase RPC
      const grouped = rows.reduce((acc, row) => {
        acc[row.table_name] = acc[row.table_name] || [];
        acc[row.table_name].push(row);
        return acc;
      }, {});

      const layers = Object.entries(grouped).map(([tableName, tableRows]) => ({
        table_name: tableName,
        columns: tableRows,
      }));

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ layers: rows })); // Return flat rows; client groups them
    } finally {
      await pool.end();
    }
  } catch (err) {
    console.error('PostGIS schema error:', err);
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Internal server error', details: err.message }));
  }
}

async function handleGitHubOAuth(req, res) {
  const allowedOrigin = process.env.APP_ORIGIN || req.headers.origin || '';
  res.setHeader('Access-Control-Allow-Origin', allowedOrigin);
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') { res.writeHead(200); res.end(); return; }
  if (req.method !== 'POST') { res.writeHead(405).end(); return; }

  try {
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    const { code, code_verifier, redirect_uri } = JSON.parse(Buffer.concat(chunks).toString());

    if (!code || !code_verifier) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Missing required parameters' }));
      return;
    }

    const tokenRes = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Accept': 'application/json' },
      body: new URLSearchParams({
        client_id: process.env.GITHUB_CLIENT_ID || process.env.VITE_GITHUB_CLIENT_ID,
        client_secret: process.env.GITHUB_CLIENT_SECRET,
        code,
        code_verifier,
        redirect_uri: redirect_uri || process.env.VITE_GITHUB_REDIRECT_URI,
      }),
    });

    const tokenData = await tokenRes.json();
    res.writeHead(tokenRes.ok ? 200 : 400, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(tokenData));
  } catch (err) {
    console.error('OAuth error:', err);
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Internal server error' }));
  }
}

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://localhost');

    if (url.pathname === '/api/github-oauth') {
      return await handleGitHubOAuth(req, res);
    }

    if (url.pathname === '/api/pg-schema') {
      return await handlePostgisSchema(req, res);
    }

    // Serve static files, fall back to index.html for SPA routing
    const pathname = url.pathname === '/' ? '/index.html' : url.pathname;
    let content;
    let filePath = join(DIST, pathname);
    try {
      content = await readFile(filePath);
    } catch {
      content = await readFile(join(DIST, 'index.html'));
      filePath = join(DIST, 'index.html');
    }

    const isAsset = filePath.includes(join(DIST, 'assets'));
    res.writeHead(200, {
      'Content-Type': MIME[extname(filePath)] || 'application/octet-stream',
      'Cache-Control': isAsset ? 'public, max-age=31536000, immutable' : 'no-cache, no-store, must-revalidate'
    });
    res.end(content);
  } catch (err) {
    console.error('Server error:', err);
    res.writeHead(500);
    res.end('Internal Server Error');
  }
});

server.listen(PORT, () => console.log(`GeoForge server running on port ${PORT}`));
