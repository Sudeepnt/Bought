import assert from 'node:assert/strict';
import { test } from 'node:test';

import { findSearchResult, searchResults } from '../lib/search';

void test('search routes each result to its specific destination', () => {
  const category = searchResults('unpopular opinion').find(
    (result) => result.type === 'category',
  );
  const page = searchResults('watchlist').find(
    (result) => result.type === 'page',
  );
  const person = searchResults('ananya').find(
    (result) => result.type === 'person',
  );

  assert.equal(category?.href, '/categories?category=UNPOPULAR%20OPINION');
  assert.equal(page?.href, '/watchlist');
  assert.equal(person?.href, '/search/person/ananya-rao');
});

void test('removed market pages are not searchable', () => {
  assert.equal(searchResults('global ladder').length, 0);
  assert.equal(searchResults('all-time').length, 0);
});

void test('static detail routes resolve to their matching record', () => {
  assert.equal(findSearchResult('company', 'notion')?.title, 'Notion');
  assert.equal(
    findSearchResult('broadcast', 'claude-kimi')?.title,
    'Is Claude still worth $30 when Kimi K3 does it for $3?',
  );
});
