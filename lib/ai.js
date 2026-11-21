const fs = require('fs');
const path = require('path');

function loadLocalEnv() {
  const envPath = path.join(__dirname, '..', '.env');
  if (!fs.existsSync(envPath)) return {};
  return Object.fromEntries(fs.readFileSync(envPath, 'utf8').split(/\r?\n/).filter(Boolean).map((line) => {
    const index = line.indexOf('=');
    return index < 0 ? [line, ''] : [line.slice(0, index).trim(), line.slice(index + 1).trim().replace(/^['"]|['"]$/g, '')];
  }));
}

async function getKey() {
  const keygenUrl = process.env.KEYGEN_URL;
  const keygenToken = process.env.KEYGEN_TOKEN;
  if (!keygenUrl || !keygenToken) throw new Error('KEYGEN_URL and KEYGEN_TOKEN are missing.');
  const response = await fetch(new URL('/getKey', keygenUrl), { headers: { Authorization: `Bearer ${keygenToken}` }, signal: AbortSignal.timeout(10000) });
  if (!response.ok) throw new Error(`Key service failed (${response.status}).`);
  const data = await response.json();
  const key = data.key || data.apiKey || data.api_key || data.data?.key || data.data?.apiKey;
  if (typeof key !== 'string' || !key.trim()) throw new Error('Key service did not return an AI key.');
  return key.trim();
}

async function askAI({ message, action, subject, brief, model, online = false }) {
  const apiKey = online ? await getKey() : loadLocalEnv().OPENAI_API_KEY;
  if (!apiKey) throw new Error(online ? 'The key service did not provide an AI key.' : 'OPENAI_API_KEY is missing from .env.');
  const subjectLine = `Subject: ${subject || 'Other'}.`;
  const studyInput = message || 'No topic was provided. Create a friendly starter worksheet with a few age-appropriate practice questions and short hints.';
  const userMessage = action === 'check'
    ? `${subjectLine} Check the student's attempt against the question or activity and the StudyAssistant response below. Do not mark an empty, missing, or clearly incomplete attempt as correct. Return exactly one of these formats, with no extra label: CORRECT or INCORRECT: followed by a short, kind explanation that teaches the method and helps the student try again. Never write the final answer, final number, correct choice, or completed solution. Do not shame the student.\n\nQuestion or activity:\n${studyInput}`
    : action === 'steps'
    ? `${subjectLine} The student says they cannot do this question or activity yet. Give a calm, numbered, step-by-step explanation that teaches the method. Start with what to identify, show the next small step, and include a quick check after each step. Give hints and reasoning, but stop before the final answer: never reveal the final number, correct choice, or completed solution. Question or activity:\n${studyInput}`
    : action === 'worksheet'
    ? `${subjectLine} Always produce a worksheet or practice activity, even when the student request is empty, one word, or very short. If the student asks for an AMC 8 question, create one original AMC 8-style practice question for a middle-school student, with answer choices when helpful and a short hint, but do not give the answer unless asked. Do not copy a named contest's exact question. Give hints and practice, not completed schoolwork. Student input:\n${studyInput}`
    : `${subjectLine} Proofread this student work. Give kind, short tips and an outline for improvement. Do not rewrite the whole assignment. Student input:\n${studyInput}`;
  const requestBody = { model, tools: [{ type: 'web_search' }], tool_choice: 'auto', max_output_tokens: 320, instructions: `${brief}\n\nKeep every answer kind, understandable, and short. Use web search when the question needs current, specific, or source-based information. Never ask for or repeat personal information. If the student includes a name, location, school, grade, or other personal detail, tell them to remove it. Do not do the student's work for them. Never give a final answer, final number, correct multiple-choice option, or completed solution; give hints, a method, and the next step so the student does the final step themselves.`, input: userMessage };
  let response;
  let lastError;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      response = await fetch('https://api.openai.com/v1/responses', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` }, body: JSON.stringify(requestBody), signal: AbortSignal.timeout(45000) });
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
  const data = await response.json();
  const outputText = data.output?.filter((item) => item.type === 'message').flatMap((item) => item.content || []).filter((content) => content.type === 'output_text').map((content) => content.text).join('\n').trim();
  return outputText || data.output_text?.trim() || 'Try again with a little more detail.';
}

module.exports = { askAI };
