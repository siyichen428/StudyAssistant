const fs = require('fs');
const path = require('path');
const { askAI } = require('../lib/ai');

const brief = fs.readFileSync(path.join(__dirname, '..', 'BRIEF.md'), 'utf8');
const notes = fs.readFileSync(path.join(__dirname, '..', 'NOTES.md'), 'utf8');
const model = (notes.match(/`([^`]*luna[^`]*)`/i) || [])[1] || 'gpt-5.6-luna';

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed.' });
  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    const message = String(body.message || '').trim();
    const action = body.action === 'worksheet' ? 'worksheet' : body.action === 'steps' ? 'steps' : body.action === 'check' ? 'check' : 'proofread';
    const subject = String(body.subject || 'Other').slice(0, 40);
    if (!message && action !== 'worksheet' && action !== 'steps') return res.status(400).json({ error: 'Add a small piece of work to proofread first.' });
    if (message.length > 5000) return res.status(400).json({ error: 'Please keep the student input under 5,000 characters.' });
    return res.status(200).json({ answer: await askAI({ message, action, subject, brief, model, online: true }) });
  } catch (error) {
    return res.status(500).json({ error: 'The AI could not answer. Please check the server settings and internet connection.' });
  }
};
