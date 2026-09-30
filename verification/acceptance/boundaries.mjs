import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { pathToFileURL } from 'node:url';

// Delivery-specific controls must stop/start owned services and disable/restore
// storage using documented operational controls, never mutate mapping contents.
// Resolve the adapter after the delivery gate; missing controls cannot pass.
export async function verifyBoundaries({ frontendOrigin, backendOrigin, controls }) {
  for (const name of ['stopBackend', 'startBackend', 'disableStorage', 'restoreStorage']) {
    assert.equal(typeof controls[name], 'function', `Missing delivered control: ${name}`);
  }
  const request = (route, options = {}) => fetch(frontendOrigin + route, { redirect: 'manual', ...options });
  const post = body => request('/api/links', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body });
  async function error(response, status, code) {
    assert.equal(response.status, status);
    assert.match(response.headers.get('content-type'), /^application\/json\b/);
    const body = await response.json();
    assert.equal(body.error.code, code);
    assert.equal(typeof body.error.message, 'string');
    assert.ok(body.error.message.length);
  }
  async function health(origin, status) { assert.equal((await fetch(origin + '/health')).status, status); }
  await health(backendOrigin, 200);
  await health(frontendOrigin, 200);
  for (const body of ['{', '{}', '{"destinationUrl":42}', '{"destinationUrl":"/relative"}', '{"destinationUrl":"mailto:visitor@example.com"}']) {
    await error(await post(body), 400, 'INVALID_INPUT');
  }
  await error(await request('/s/unknown-' + crypto.randomUUID()), 404, 'NOT_FOUND');
  const destination = 'https://www.manning.com/books/spec-driven-development?acceptance=preserve&value=a%2Fb#chapter-5';
  const created = await post(JSON.stringify({ destinationUrl: destination }));
  assert.equal(created.status, 201);
  const { shortUrl } = await created.json();
  assert.equal(new URL(shortUrl).origin, frontendOrigin);
  async function resolves() {
    const response = await fetch(shortUrl, { redirect: 'manual' });
    assert.equal(response.status, 302);
    assert.equal(response.headers.get('location'), destination);
  }
  await resolves();
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    await page.goto(frontendOrigin);
    await page.getByRole('textbox').or(page.locator('input[type="url"]')).fill(destination);
    const creation = page.waitForResponse(r => r.url() === frontendOrigin + '/api/links' && r.request().method() === 'POST');
    await page.getByRole('button', { name: 'Shorten URL', exact: true }).click();
    const result = await creation;
    assert.equal(result.status(), 201);
    const displayedUrl = (await result.json()).shortUrl;
    const link = page.getByRole('link', { name: displayedUrl, exact: true });
    await link.waitFor({ state: 'visible' });
    const redirect = page.waitForResponse(r => r.url() === displayedUrl);
    const navigation = page.waitForURL(destination, { waitUntil: 'commit' });
    await link.click({ noWaitAfter: true });
    assert.equal((await redirect).headers()['location'], destination);
    await navigation;
    assert.equal(page.url(), destination);
    await controls.stopBackend();
    try {
      await health(frontendOrigin, 503);
      await error(await post(JSON.stringify({ destinationUrl: destination })), 503, 'BACKEND_UNAVAILABLE');
      await error(await fetch(shortUrl, { redirect: 'manual' }), 503, 'BACKEND_UNAVAILABLE');
    } finally { await controls.startBackend(); }
    await health(backendOrigin, 200);
    await health(frontendOrigin, 200);
    await resolves(); // Same storage and port must be retained by the adapter.
    await page.goto(frontendOrigin);
    await controls.disableStorage();
    try {
      await health(backendOrigin, 503);
      await health(frontendOrigin, 503);
      await error(await post(JSON.stringify({ destinationUrl: destination })), 503, 'STORAGE_UNAVAILABLE');
      await error(await fetch(shortUrl, { redirect: 'manual' }), 503, 'STORAGE_UNAVAILABLE');
      await page.getByRole('textbox').or(page.locator('input[type="url"]')).fill(destination);
      const failure = page.waitForResponse(r => r.url() === frontendOrigin + '/api/links');
      await page.getByRole('button', { name: 'Shorten URL', exact: true }).click();
      const failed = await failure;
      assert.equal(failed.status(), 503);
      const message = (await failed.json()).error.message;
      await page.getByText(message, { exact: false }).waitFor({ state: 'visible' });
      assert.equal(await page.locator('a[href*="/s/"]').count(), 0, 'No successful link during storage failure');
    } finally { await controls.restoreStorage(); }
    await health(backendOrigin, 200);
    await health(frontendOrigin, 200);
    await resolves();
  } finally { await browser.close(); }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  assert.ok(process.env.ACCEPTANCE_CONTROLS, 'Set ACCEPTANCE_CONTROLS to the adapter resolved from delivered setup instructions');
  const controls = await import(pathToFileURL(process.env.ACCEPTANCE_CONTROLS).href);
  await verifyBoundaries({ frontendOrigin: process.env.FRONTEND_ORIGIN, backendOrigin: process.env.BACKEND_ORIGIN, controls });
  console.log('All additional Design boundary checks passed');
}
