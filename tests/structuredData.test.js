// The schema.org block in index.html (the app and the website, as one @graph): valid JSON, Google-accepted category,
// and claims that match the site.

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const blocks = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map((m) => m[1]);

// Google's accepted applicationCategory values for software app structured data.
const CATEGORIES = ['GameApplication', 'SocialNetworkingApplication', 'TravelApplication', 'ShoppingApplication', 'SportsApplication',
  'LifestyleApplication', 'BusinessApplication', 'DesignApplication', 'DeveloperApplication', 'DriverApplication', 'EducationalApplication',
  'HealthApplication', 'FinanceApplication', 'SecurityApplication', 'BrowserApplication', 'CommunicationApplication',
  'DesktopEnhancementApplication', 'EntertainmentApplication', 'MultimediaApplication', 'HomeApplication', 'UtilitiesApplication', 'ReferenceApplication'];

describe('Structured data: DraftLine as a SoftwareApplication', () => {
  it('is one block of valid JSON in the head', () => {
    assert.equal(blocks.length, 1);
    assert.ok(html.indexOf('application/ld+json') < html.indexOf('</head>'));
    JSON.parse(blocks[0]);
  });

  const data = (JSON.parse(blocks[0] || '{}')['@graph'] || [])[0] || {};

  it('names the app, its canonical URL and a Google-accepted category', () => {
    assert.equal(JSON.parse(blocks[0])['@context'], 'https://schema.org');
    assert.equal(data['@type'], 'WebApplication', "schema.org's SoftwareApplication for the web (it owns browserRequirements)");
    assert.equal(data.name, 'DraftLine');
    assert.match(html, new RegExp(`<link rel="canonical" href="${data.url.replace(/[.]/g, '\\.')}"`), 'same URL as the canonical link');
    assert.ok(CATEGORIES.includes(data.applicationCategory), data.applicationCategory);
    assert.ok(data.operatingSystem);
  });

  it('is free: price 0 and an MIT licence, with no invented ratings or reviews', () => {
    assert.equal(data.offers.price, '0');
    assert.equal(data.offers.priceCurrency, 'USD');
    assert.equal(data.isAccessibleForFree, true);
    assert.match(data.license, /MIT/);
    assert.equal(data.aggregateRating, undefined);
    assert.equal(data.review, undefined);
  });

  it('only claims what is true of the site: no telemetry from the editor, not "zero telemetry"', () => {
    assert.doesNotMatch(data.description, /zero telemetry/i);
    assert.match(data.description, /no telemetry from the editor/);
    assert.match(readFileSync(new URL('../README.md', import.meta.url), 'utf8'), /The editor\s+sends nothing about you or your writing anywhere/);
  });

  it('points at images that ship with the site', () => {
    for (const u of [data.image, ...data.screenshot]) {
      assert.ok(u.startsWith(data.url));
      readFileSync(new URL('../public/' + u.slice(data.url.length), import.meta.url));
    }
  });
});
