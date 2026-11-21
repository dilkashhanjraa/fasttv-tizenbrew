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
  assert.equal(pkg.serviceFile, 'service.js');
  assert.ok(fs.existsSync(path.join(base, pkg.serviceFile)));
});

test('TV app links stay relative and bundled, without a Tizen Studio manifest', () => {
  const html = fs.readFileSync(path.join(base, pkg.appPath), 'utf8');
  assert.match(html, /src="core\.js"/);
  assert.match(html, /src="app\.js"/);
  assert.match(html, /href="styles\.css"/);
  assert.equal(fs.existsSync(path.join(base, 'config.xml')), false);
});

test('TizenBrew UI uses module protocol and delegates native APIs to a local service', () => {
  const app = fs.readFileSync(path.join(base, 'app/app.js'), 'utf8');
  assert.match(app, /ws:\/\/127\.0\.0\.1:8081/);
  assert.match(app, /type: 4/);
  assert.match(app, /type: 5, payload: module/);
  assert.match(app, /127\.0\.0\.1:8094/);
  assert.doesNotMatch(app, /tizen\.application\./);
  const service = fs.readFileSync(path.join(base, 'service.js'), 'utf8');
  assert.match(service, /tizen\.application|appApi\.launch/);
  assert.match(service, /127\.0\.0\.1/);
  assert.match(service, /req\.headers\.origin/);
  assert.match(service, /knownApps\[id\]/);
});
