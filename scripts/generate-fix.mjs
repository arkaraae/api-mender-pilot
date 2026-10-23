import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { pathToFileURL } from 'node:url';

const root = resolve(import.meta.dirname, '..');
const engineRoot = resolve(process.env.MENDER_ENGINE_ROOT || join(root, 'engine'));
const artifacts = join(root, 'artifacts');
const clientPath = join(root, 'src/client.mjs');
const endpoint = '/api/managed/quotes';
const before = JSON.parse(await readFile(join(artifacts, 'before.json'), 'utf8'));
const after = JSON.parse(await readFile(join(artifacts, 'after.json'), 'utf8'));
const source = await readFile(clientPath, 'utf8');
const failure = await readFile(join(artifacts, 'baseline-test.log'), 'utf8');
const { rulesFromOpenApi, proveWithSchemas } = await import(pathToFileURL(join(engineRoot, 'mender/src/openapi.js')).href);
const { fixConsumer } = await import(pathToFileURL(join(engineRoot, 'mender/src/codefix.js')).href);

function requestFields(spec) {
  const fields = spec.paths?.[endpoint]?.post?.requestBody?.content?.['application/json']?.schema?.required;
  if (!Array.isArray(fields) || !fields.every(field => typeof field === 'string')) throw new Error('Invalid Quote API contract');
  return fields;
}

function isolatedRequestEdit(original, proposal) {
  if (proposal === original || proposal.length > 30_000) return false;
  const pattern = /body:\s*JSON\.stringify\(\{([^{}]*)\}\),/g;
  const oldCalls = [...original.matchAll(pattern)];
  const newCalls = [...proposal.matchAll(pattern)];
  if (oldCalls.length !== 1 || newCalls.length !== 1) return false;
  const oldCall = oldCalls[0];
  const newCall = newCalls[0];
  if (original.slice(0, oldCall.index) !== proposal.slice(0, newCall.index)
    || original.slice(oldCall.index + oldCall[0].length) !== proposal.slice(newCall.index + newCall[0].length)) return false;
  const parts = newCall[1].split(',').map(part => part.trim()).filter(Boolean);
  if (!parts.length || parts.length > 8 || !parts.every(part => /^[A-Za-z_$][\w$]*(?:\s*:\s*(?:customerId|sku))?$/.test(part))) return false;
  const keys = parts.map(part => part.split(':')[0].trim());
  return new Set(keys).size === keys.length && requestFields(after).every(field => keys.includes(field));
}

if (!failure.includes('422')) throw new Error('The old consumer did not fail with HTTP 422');
const oldVersion = Number.parseInt(before.info?.version, 10);
const newVersion = Number.parseInt(after.info?.version, 10);
if (!Number.isInteger(oldVersion) || !Number.isInteger(newVersion) || newVersion <= oldVersion) throw new Error('No newer API version');
if (JSON.stringify(before.servers) !== JSON.stringify(after.servers)) throw new Error('API server changed; review manually');
requestFields(before);
requestFields(after);

const found = rulesFromOpenApi(before, after);
const proof = proveWithSchemas(before, after, found.rules);
let candidate = null;
if (found.rules.length && proof.ok) {
  const deterministic = fixConsumer(source, found.rules, { paths: [endpoint] });
  if (!deterministic.needsDecision && isolatedRequestEdit(source, deterministic.after))
    candidate = { ...deterministic, model: 'Mender contract rules' };
}
if (!candidate && process.env.ANTHROPIC_API_KEY) {
  const { generateAiFix } = await import(pathToFileURL(join(engineRoot, 'scripts/ai-fix-provider.mjs')).href);
  candidate = await generateAiFix({
    oldContract: before, newContract: after, file: 'src/client.mjs',
    before: source, failingTest: failure.slice(0, 5000),
  }, { provider: 'anthropic' });
}
if (!candidate || candidate.needsDecision || !isolatedRequestEdit(source, candidate.after))
  throw new Error(candidate?.needsDecision || 'No bounded, reviewable repair could be generated');
await mkdir(artifacts, { recursive: true });
await writeFile(join(artifacts, 'proposed-client.mjs'), candidate.after);
await writeFile(join(artifacts, 'repair.json'), JSON.stringify({
  version: newVersion, method: candidate.model, summary: candidate.summary,
  oldFields: requestFields(before), newFields: requestFields(after),
  schemaProof: proof.ok, usage: candidate.usage || null,
}, null, 2) + '\n');
console.log(`Proposed bounded repair for Quote API v${newVersion} via ${candidate.model}`);
