import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const directory = path.join(root, 'docs/presentations');
const captures = path.join(directory, 'ai-walkthrough-captures');

function readableConversation(snapshot) {
  const lines = (snapshot.split('  - log:\n')[1] ?? '').split('  - textbox')[0].split('\n');
  const turns = [];
  let turn;
  let product;
  for (const line of lines) {
    const role = line.match(/^    - generic: (You|AI Stylist)$/);
    if (role) {
      turn = { role: role[1], paragraphs: [], products: [] };
      turns.push(turn);
      product = undefined;
      continue;
    }
    if (!turn) continue;
    const paragraph = line.match(/^    - paragraph: (.+)$/);
    if (paragraph) {
      let value = paragraph[1];
      if (value.startsWith('"')) {
        try { value = JSON.parse(value); } catch { /* Preserve the captured text. */ }
      }
      turn.paragraphs.push(value);
    }
    const name = line.match(/^          - link "([^"\n]+)":$/);
    if (name && !name[1].startsWith('View ')) product = name[1];
    const price = line.match(/^          - paragraph: (A\$[\d,.]+)$/);
    if (product && price) {
      turn.products.push(`${product}: ${price[1]}`);
      product = undefined;
    }
  }
  if (!turns.length) throw new Error('The capture contains no conversation messages');
  return turns.map(item => [
    item.role.toUpperCase(),
    ...item.paragraphs,
    ...(item.products.length ? ['Products shown:\n' + [...new Set(item.products)].join('\n')] : []),
  ].join('\n\n')).join('\n\n\n');
}

const manifest = JSON.parse(await fs.readFile(path.join(captures, 'manifest.json'), 'utf8'));
const content = JSON.parse(await fs.readFile(path.join(directory, 'ai-walkthrough-content.json'), 'utf8'));
const ids = new Set();
for (const story of content.stories) {
  if (story.steps.length < 4) throw new Error(`Story ${story.id} needs at least four steps`);
  for (const step of story.steps) {
    if (ids.has(step.id)) throw new Error(`Duplicate step: ${step.id}`);
    ids.add(step.id);
    const capture = manifest.find(item => item.id === step.id);
    if (!capture) throw new Error(`Missing live capture: ${step.id}`);
    if (!capture.prompt.trim()) throw new Error(`Missing prompt: ${step.id}`);
    if (step.vote?.options.some(option => !option.prompt.trim())) {
      throw new Error(`Missing vote prompt: ${step.id}`);
    }
    const imagePath = path.join(captures, capture.image);
    const { width, height } = await sharp(imagePath).metadata();
    const transcript = await fs.readFile(path.join(captures, capture.transcript), 'utf8');
    Object.assign(step, capture, {
      landscape: width > height,
      image: `data:image/jpeg;base64,${(await fs.readFile(imagePath)).toString('base64')}`,
      transcript,
      conversation: readableConversation(transcript),
    });
  }
}
const template = await fs.readFile(path.join(directory, 'ai-walkthrough.template.html'), 'utf8');
const payload = JSON.stringify(content).replace(/</g, '\\u003c');
const html = template.replace('/* WALKTHROUGH_DATA */', payload);
if (html.includes('/* WALKTHROUGH_DATA */')) throw new Error('Unfilled template');
await fs.writeFile(path.join(directory, 'ai-walkthrough.html'), html);
console.log(`Built ${content.stories.length} stories, ${manifest.length} real website captures, ${(Buffer.byteLength(html) / 1024 / 1024).toFixed(1)} MB`);
