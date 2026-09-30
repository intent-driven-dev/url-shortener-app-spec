import assert from 'node:assert/strict';
import { Before, After, Given, When, Then, setDefaultTimeout } from '@cucumber/cucumber';
import { chromium } from 'playwright';

setDefaultTimeout(30000);
const origin = process.env.FRONTEND_ORIGIN || 'http://127.0.0.1:3100';
Before(async function () {
  this.browser = await chromium.launch();
  this.page = await this.browser.newPage();
});
After(async function () { await this.browser?.close(); });
const field = world => world.page.getByRole('textbox').or(world.page.locator('input[type="url"]'));
Given('a visitor has opened the URL creation form', async function () {
  await this.page.goto(origin + '/');
});
When('the visitor views the form', async function () { assert.equal(new URL(this.page.url()).pathname, '/'); });
Then('a destination URL field is visible', async function () { assert.equal(await field(this).isVisible(), true); });
Then('a button labeled {string} is visible', async function (label) { assert.equal(await this.page.getByRole('button', { name: label, exact: true }).isVisible(), true); });
Given('the visitor has entered {string} in the destination URL field', async function (destination) {
  this.destination = destination;
  await field(this).fill(destination);
});
async function submit(label) {
  const response = this.page.waitForResponse(r => r.url() === origin + '/api/links' && r.request().method() === 'POST');
  await this.page.getByRole('button', { name: label, exact: true }).click();
  this.creation = await response;
}
When('the visitor chooses {string}', submit);
Given('the visitor has chosen {string}', submit);
async function completed() {
  assert.equal(this.creation.status(), 201);
  assert.match(this.creation.headers()['content-type'], /^application\/json\b/);
  assert.deepEqual(this.creation.request().postDataJSON(), { destinationUrl: this.destination });
  this.shortUrl = (await this.creation.json()).shortUrl;
  const url = new URL(this.shortUrl);
  assert.equal(url.origin, origin);
  assert.match(url.pathname, /^\/s\/[^/]+$/);
  assert.equal(url.search + url.hash, '');
}
Then('URL creation completes successfully', completed);
Given('URL creation has completed successfully', completed);
Then('a short URL is generated for {string}', async function (destination) {
  const response = await fetch(this.shortUrl, { redirect: 'manual' });
  assert.equal(response.status, 302);
  assert.equal(response.headers.get('location'), destination);
});
async function displayed() {
  this.link = this.page.getByRole('link', { name: this.shortUrl, exact: true });
  await this.link.waitFor({ state: 'visible' });
  assert.equal(await this.link.getAttribute('href'), this.shortUrl);
  const result = this.page.getByRole('status');
  assert.equal(await result.isVisible(), true, 'Delivered result region is visible');
  assert.equal(await result.getByRole('link', { name: this.shortUrl, exact: true }).count(), 1);
  assert.ok((await result.textContent()).includes(this.shortUrl));
}
Then('the result area displays the short URL generated for {string}', async function (destination) {
  assert.equal(this.destination, destination);
  await displayed.call(this);
});
Given('the result area displays the generated short URL', displayed);
When('the visitor selects the displayed short URL', async function () {
  const response = this.page.waitForResponse(r => r.url() === this.shortUrl);
  const request = this.page.waitForRequest(r => r.isNavigationRequest() && r.url() === this.destination.split('#')[0]);
  // Remote content is irrelevant; the real outgoing navigation is observed.
  const navigation = this.page.waitForURL(this.destination, { waitUntil: 'commit' });
  await this.link.click({ noWaitAfter: true });
  this.redirect = await response;
  this.destinationRequest = await request;
  await navigation;
});
Then('the visitor follows that short URL', async function () {
  assert.equal(this.redirect.status(), 302);
  assert.equal(this.redirect.headers()['location'], this.destination);
  assert.equal(this.destinationRequest.redirectedFrom()?.url(), this.shortUrl);
});
Then('the browser navigates to {string}', async function (destination) {
  assert.equal(this.destinationRequest.url(), destination.split('#')[0]);
  assert.equal(this.page.url(), destination);
});
