const http = require('http');
const fs = require('fs');
const path = require('path');
const { askAI } = require('./lib/ai');

const ROOT = __dirname;
const PORT = Number(process.env.PORT || 3000);
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8' };
const brief = fs.readFileSync(path.join(ROOT, 'BRIEF.md'), 'utf8');
const notes = fs.readFileSync(path.join(ROOT, 'NOTES.md'), 'utf8');
const model = (notes.match(/`([^`]*luna[^`]*)`/i) || [])[1] || 'gpt-5.6-luna';

function send(res, status, body, type = 'application/json; charset=utf-8') {
  res.writeHead(status, { 'Content-Type': type, 'Cache-Control': 'no-store' });
  res.end(type.startsWith('application/json') ? JSON.stringify(body) : body);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (chunk) => { data += chunk; if (data.length > 12000) reject(new Error('Message is too long.')); });
    req.on('end', () => resolve(data));
    req.on('error', reject);
  });
}

const server = http.createServer(async (req, res) => {
  try {
    if (req.method === 'POST' && req.url === '/api/ai') {
      const body = JSON.parse(await readBody(req));
      const message = String(body.message || '').trim();
      const action = body.action === 'worksheet' ? 'worksheet' : body.action === 'steps' ? 'steps' : body.action === 'check' ? 'check' : 'proofread';
      const subject = String(body.subject || 'Other').slice(0, 40);
      if (!message && action !== 'worksheet' && action !== 'steps') return send(res, 400, { error: 'Add a small piece of work to proofread first.' });
      if (message.length > 5000) return send(res, 400, { error: 'Please keep the student input under 5,000 characters.' });
      return send(res, 200, { answer: await askAI({ message, action, subject, brief, model }) });
    }
    const requested = req.url === '/' ? '/index.html' : req.url.split('?')[0];
    const publicRoot = path.resolve(path.join(ROOT, 'public'));
    const file = path.resolve(publicRoot, `.${requested}`);
    if (!file.startsWith(publicRoot + path.sep) || !fs.existsSync(file)) return send(res, 404, { error: 'Not found' });
    send(res, 200, fs.readFileSync(file), MIME[path.extname(file)] || 'application/octet-stream');
  } catch (error) {
    send(res, 500, { error: 'The AI could not answer. Please check the key and internet connection.' });
  }
});

server.listen(PORT, () => console.log(`StudyAssistant running at http://localhost:${PORT}`));
