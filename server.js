const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const PORT = Number(process.env.PORT || 3000);
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.md': 'text/markdown; charset=utf-8' };

function loadEnv() {
  const envPath = path.join(ROOT, '.env');
  if (!fs.existsSync(envPath)) return {};
  return Object.fromEntries(fs.readFileSync(envPath, 'utf8').split(/\r?\n/).filter(Boolean).map((line) => {
    const index = line.indexOf('=');
    return index < 0 ? [line, ''] : [line.slice(0, index).trim(), line.slice(index + 1).trim().replace(/^['"]|['"]$/g, '')];
  }));
}

const env = loadEnv();
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

async function askAI(message, action) {
  if (!env.OPENAI_API_KEY) throw new Error('OPENAI_API_KEY is missing.');
  const userMessage = action === 'worksheet'
    ? `Make a short custom worksheet from this student question or topic. Give hints and practice, not the completed answers. Student input:\n${message}`
    : `Proofread this student work. Give kind, short tips and an outline for improvement. Do not rewrite the whole assignment. Student input:\n${message}`;
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${env.OPENAI_API_KEY}` },
    body: JSON.stringify({ model, max_completion_tokens: 180, messages: [
      { role: 'system', content: `${brief}\n\nKeep every answer kind, understandable, and short. Never ask for or repeat personal information. If the student includes a name, location, school, grade, or other personal detail, tell them to remove it. Do not do the student's work for them.` },
      { role: 'user', content: userMessage },
    ] }),
  });
  if (!response.ok) throw new Error(`AI request failed (${response.status}).`);
  const data = await response.json();
  return data.choices?.[0]?.message?.content?.trim() || 'Try again with a little more detail.';
}

const server = http.createServer(async (req, res) => {
  try {
    if (req.method === 'POST' && req.url === '/api/ai') {
      const body = JSON.parse(await readBody(req));
      const message = String(body.message || '').trim();
      const action = body.action === 'worksheet' ? 'worksheet' : 'proofread';
      if (!message) return send(res, 400, { error: 'Add a question or a small piece of work first.' });
      if (message.length > 5000) return send(res, 400, { error: 'Please keep the student input under 5,000 characters.' });
      return send(res, 200, { answer: await askAI(message, action) });
    }
    const requested = req.url === '/' ? '/index.html' : req.url.split('?')[0];
    const file = path.resolve(ROOT, `public${requested}`);
    if (!file.startsWith(path.resolve(path.join(ROOT, 'public')))) return send(res, 404, { error: 'Not found' });
    if (!fs.existsSync(file)) return send(res, 404, { error: 'Not found' });
    send(res, 200, fs.readFileSync(file), MIME[path.extname(file)] || 'application/octet-stream');
  } catch (error) {
    send(res, 500, { error: 'The AI could not answer. Please check the key and internet connection.' });
  }
});

server.listen(PORT, () => console.log(`StudyAssistant running at http://localhost:${PORT}`));
