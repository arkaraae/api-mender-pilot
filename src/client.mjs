// A separate consumer of API Mender's live, Supabase-backed Quote API.
// A contract change should make this call fail until the consumer is updated.
export async function createQuote(customerId, sku = 'WIDGET-1', fetch = globalThis.fetch) {
  const response = await fetch('https://apimender.com/api/managed/quotes', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ customerId, sku }),
  });
  const body = await response.json();
  if (!response.ok) throw new Error(`Quote API returned ${response.status}: ${JSON.stringify(body)}`);
  return body;
}
