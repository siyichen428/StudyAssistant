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

async function askAI(message, action, subject) {
  if (!env.OPENAI_API_KEY) throw new Error('OPENAI_API_KEY is missing.');
  const subjectLine = `Subject: ${subject || 'Other'}.`;
  const studyInput = message || 'No topic was provided. Create a friendly starter worksheet with a few age-appropriate practice questions and short hints.';
  const userMessage = action === 'steps'
    ? `${subjectLine} The student says they cannot do this question or activity yet. Give a calm, numbered, step-by-step explanation that teaches the method. Start with what to identify, show the next small step, and include a quick check after each step. Give hints and reasoning, but do not reveal the final answer unless it is needed to demonstrate a step. Question or activity:\n${studyInput}`
    : action === 'worksheet'
    ? `${subjectLine} Always produce a worksheet or practice activity, even when the student request is empty, one word, or very short. If the student asks for an AMC 8 question, create one original AMC 8-style practice question for a middle-school student, with answer choices when helpful and a short hint, but do not give the answer unless asked. Do not copy a named contest's exact question. Give hints and practice, not completed schoolwork. Student input:\n${studyInput}`
    : `${subjectLine} Proofread this student work. Give kind, short tips and an outline for improvement. Do not rewrite the whole assignment. Student input:\n${studyInput}`;
  const requestBody = {
    model,
    tools: [{ type: 'web_search' }],
    tool_choice: 'auto',
    max_output_tokens: 320,
    instructions: `${brief}\n\nKeep every answer kind, understandable, and short. Use web search when the question needs current, specific, or source-based information. Never ask for or repeat personal information. If the student includes a name, location, school, grade, or other personal detail, tell them to remove it. Do not do the student's work for them.`,
    input: userMessage,
  };
  let response;
  let lastError;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      response = await fetch('https://api.openai.com/v1/responses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${env.OPENAI_API_KEY}` },
        body: JSON.stringify(requestBody),
        signal: AbortSignal.timeout(45000),
      });
      if (response.ok) break;
      lastError = new Error(`AI request failed (${response.status}).`);
      if (response.status < 500 && response.status !== 429) throw lastError;
    } catch (error) {
      lastError = error;
      if (error.name === 'AbortError' && attempt === 0) continue;
      if (attempt === 1) throw error;
    }
    await new Promise((resolve) => setTimeout(resolve, 700));
  }
  if (!response?.ok) throw lastError || new Error('AI request failed.');
  if (!response.ok) throw new Error(`AI request failed (${response.status}).`);
  const data = await response.json();
  const outputText = data.output
    ?.filter((item) => item.type === 'message')
    .flatMap((item) => item.content || [])
    .filter((content) => content.type === 'output_text')
    .map((content) => content.text)
    .join('\n')
    .trim();
  return outputText || data.output_text?.trim() || 'Try again with a little more detail.';
}

const server = http.createServer(async (req, res) => {
  try {
    if (req.method === 'POST' && req.url === '/api/ai') {
      const body = JSON.parse(await readBody(req));
      const message = String(body.message || '').trim();
      const action = body.action === 'worksheet' ? 'worksheet' : body.action === 'steps' ? 'steps' : 'proofread';
      const subject = String(body.subject || 'Other').slice(0, 40);
      if (!message && action !== 'worksheet' && action !== 'steps') return send(res, 400, { error: 'Add a small piece of work to proofread first.' });
      if (message.length > 5000) return send(res, 400, { error: 'Please keep the student input under 5,000 characters.' });
      return send(res, 200, { answer: await askAI(message, action, subject) });
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
