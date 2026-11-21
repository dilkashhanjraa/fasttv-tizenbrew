const { test } = require('node:test');
const assert = require('node:assert/strict');
const service = require('../service-core.js');

test('parses visible Tizen application manifests and ignores hidden ones', () => {
  const xml = '<manifest><ui-application appid="abc.Player" nodisplay="false"><label>Player</label><icon>/opt/apps/player.png</icon></ui-application>' +
    '<ui-application appid="abc.Hidden" nodisplay="true"><label>Hidden</label></ui-application></manifest>';
  assert.deepEqual(service.parseManifest(xml).map(a => a.name), ['Player']);
});
test('selects English app label when available', () => {
  const xml = '<ui-application appid="xyz.Movies"><label xml:lang="fr_FR">Films</label><label xml:lang="en_US">Movies</label></ui-application>';
  assert.equal(service.parseManifest(xml)[0].name,'Movies');
});
test('rejects unsafe app ids and icon paths', () => {
  assert.equal(service.validId('../bad'),false);
  assert.equal(service.validId('native.App_1'),true);
  assert.equal(service.validIcon('/opt/icons/logo.png'),true);
  assert.equal(service.validIcon('/opt/icons/../secret.png'),false);
  assert.equal(service.validIcon('/etc/passwd'),false);
});
