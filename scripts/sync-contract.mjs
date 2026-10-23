import { writeFile } from 'node:fs/promises';

const response = await fetch('https://apimender.com/api/managed/openapi.json', {
  headers: { accept: 'application/json' },
  signal: AbortSignal.timeout(15000),
  redirect: 'error',
});
if (!response.ok) throw new Error(`Published contract returned HTTP ${response.status}`);
const source = await response.text();
if (Buffer.byteLength(source) > 512_000) throw new Error('Published contract exceeds 512 KB');
const contract = JSON.parse(source);
if (!/^3\.(0|1)\./.test(contract.openapi || '') || !contract.paths?.['/api/managed/quotes']?.post) {
  throw new Error('Unexpected Quote API contract');
}
contract.servers = [{ url: 'https://apimender.com' }];
await writeFile(new URL('../openapi.json', import.meta.url), JSON.stringify(contract, null, 2) + '\n');
console.log(`Synchronized published contract version ${contract.info?.version || 'unknown'}`);
