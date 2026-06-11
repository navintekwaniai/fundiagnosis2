const https = require('https');
const http  = require('http');

const PORT = process.env.PORT || 3000;
const ANTHROPIC_KEY = process.env.ANTHROPIC_KEY || '';

function cors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,x-api-key');
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let d = '';
    req.on('data', c => d += c);
    req.on('end', () => resolve(d));
    req.on('error', reject);
  });
}

function proxyAnthropic(body, apiKey, res) {
  const key = apiKey || ANTHROPIC_KEY;
  const buf = Buffer.from(body);
  const req = https.request({
    hostname: 'api.anthropic.com',
    path: '/v1/messages',
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'content-length': buf.length,
      'x-api-key': key,
      'anthropic-version': '2023-06-01'
    }
  }, (r) => {
    let d = '';
    r.on('data', c => d += c);
    r.on('end', () => { cors(res); res.writeHead(r.statusCode, {'content-type':'application/json'}); res.end(d); });
  });
  req.on('error', e => { cors(res); res.writeHead(502, {'content-type':'application/json'}); res.end(JSON.stringify({error:{message:e.message}})); });
  req.write(buf); req.end();
}

function fetchAMFI(fundCode, res) {
  const url = `https://api.mfapi.in/mf/${fundCode}`;
  https.get(url, (r) => {
    let d = '';
    r.on('data', c => d += c);
    r.on('end', () => { cors(res); res.writeHead(200, {'content-type':'application/json'}); res.end(d); });
  }).on('error', e => { cors(res); res.writeHead(502); res.end(JSON.stringify({error:e.message})); });
}

http.createServer(async (req, res) => {
  if (req.method === 'OPTIONS') { cors(res); res.writeHead(204); return res.end(); }
  if (req.method === 'POST' && req.url === '/api/claude') {
    const body = await readBody(req);
    const apiKey = req.headers['x-api-key'] || '';
    return proxyAnthropic(body, apiKey, res);
  }
  if (req.method === 'GET' && req.url.startsWith('/api/amfi/')) {
    const code = req.url.replace('/api/amfi/', '');
    return fetchAMFI(code, res);
  }
  if (req.url === '/') {
    cors(res); res.writeHead(200, {'content-type':'application/json'});
    return res.end(JSON.stringify({status:'ok'}));
  }
  res.writeHead(404); res.end();
}).listen(PORT, () => console.log('Server running on port', PORT));
