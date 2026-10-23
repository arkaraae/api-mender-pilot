import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createQuote } from '../src/client.mjs';

test('consumer sends the current customerId contract', async () => {
  let request;
  const result = await createQuote('pilot-customer', 'WIDGET-1', async (url, options) => {
    request = { url, options };
    return Response.json({ id: 'quote_1', sku: 'WIDGET-1', amountCents: 100, contractVersion: 1 });
  });
  assert.equal(request.url, 'https://apimender.com/api/managed/quotes');
  assert.equal(request.options.method, 'POST');
  assert.deepEqual(JSON.parse(request.options.body), { customerId: 'pilot-customer', sku: 'WIDGET-1' });
  assert.equal(result.id, 'quote_1');
});

test('live database-backed Quote API accepts the consumer', { skip: process.env.PILOT_LIVE !== '1' }, async () => {
  const quote = await createQuote('mender-pilot');
  assert.match(quote.id, /^quote_/);
  assert.equal(quote.sku, 'WIDGET-1');
  assert.equal(typeof quote.amountCents, 'number');
  assert.equal(typeof quote.contractVersion, 'number');
});
