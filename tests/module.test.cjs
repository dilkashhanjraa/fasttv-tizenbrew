const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const base = path.resolve(__dirname, '..');
const pkg = require('../package.json');

test('TizenBrew manifest specifies a valid self-contained application module', () => {
  assert.equal(pkg.packageType, 'app');
  assert.equal(pkg.appName, 'FastTV - Dilkash Edition');
  assert.equal(pkg.appPath, 'app/index.html');
  assert.ok(Array.isArray(pkg.keys));
  assert.ok(fs.existsSync(path.join(base, pkg.appPath)));
  assert.equal(pkg.serviceFile, undefined, 'no background-service privileges');
});

test('TV app links stay relative and bundled, without a Tizen Studio manifest', () => {
  const html = fs.readFileSync(path.join(base, pkg.appPath), 'utf8');
  assert.match(html, /src="core\.js"/);
  assert.match(html, /src="app\.js"/);
  assert.match(html, /href="styles\.css"/);
  assert.equal(fs.existsSync(path.join(base, 'config.xml')), false);
});

test('TizenBrew bridge uses module protocol and excludes Tizen device APIs', () => {
  const app = fs.readFileSync(path.join(base, 'app/app.js'), 'utf8');
  assert.match(app, /ws:\/\/127\.0\.0\.1:8081/);
  assert.match(app, /type: 4/);
  assert.match(app, /type: 5, payload: module/);
  assert.doesNotMatch(app, /tizen\.application\./);
});
