// FastTV optional native-app bridge. Runs as a TizenBrew module service, not in
// the TV's webpage. Loopback-only, with origin checks and a narrow API.
'use strict';

var http = require('http');
var fs = require('fs');
var url = require('url');
var helpers = require('./service-core');
var PORT = 8094;
var ORIGINS = ['http://127.0.0.1:8081', 'http://localhost:8081'];
var HOSTS = ['127.0.0.1:' + PORT, 'localhost:' + PORT];
var DIRECTORIES = ['/opt/share/packages', '/usr/share/packages'];
var MAX_FILE = 2 * 1024 * 1024;
var icons = {};
var knownApps = {};

function send(res, status, body, type) {
  if (res.headersSent) return;
  res.setHeader('Content-Type', type || 'text/plain; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.statusCode = status;
  res.end(body);
}

function sendError(res, status, message) {
  send(res, status, JSON.stringify({ error: message }), 'application/json; charset=utf-8');
}

function scanPackages(done) {
  var remaining = DIRECTORIES.length, results = [], failures = [];
  DIRECTORIES.forEach(function (dir) {
    fs.readdir(dir, function (error, filenames) {
      if (error) { failures.push(dir + ': ' + error.code); return complete(); }
      var xmlFiles = filenames.filter(function (f) { return /^[A-Za-z0-9._-]+\.xml$/i.test(f); }).slice(0, 600);
      var pending = xmlFiles.length;
      if (!pending) return complete();
      xmlFiles.forEach(function (filename) {
        fs.readFile(dir + '/' + filename, 'utf8', function (readError, data) {
          if (!readError && data.length <= MAX_FILE) {
            results = results.concat(helpers.parseManifest(data));
          }
          if (--pending === 0) complete();
        });
      });
    });
  });
  function complete() {
    if (--remaining > 0) return;
    var unique = {}, output = [];
    results.forEach(function (item) {
      if (!unique[item.id] && output.length < 250) { unique[item.id] = true; output.push(item); }
    });
    done(output, failures);
  }
}

function useAppList(res, items, source) {
  icons = {};
  knownApps = {};
  var safe = [];
  items.forEach(function (app) {
    if (!app || !helpers.validId(app.id) || app.show === false ||
        knownApps[app.id] || safe.length >= 250) return;
    knownApps[app.id] = true;
    var hasIcon = helpers.validIcon(app.iconPath);
    if (hasIcon) icons[app.id] = app.iconPath;
    safe.push({ id: app.id, name: String(app.name || app.id).slice(0, 90), icon: hasIcon });
  });
  send(res, 200, JSON.stringify({ source: source, apps: safe }), 'application/json; charset=utf-8');
}

function listInstalled(res) {
  var appApi = typeof tizen !== 'undefined' && tizen.application;
  function fallback() {
    scanPackages(function (items, errors) {
      if (!items.length && errors.length) return sendError(res, 503, 'TV app catalogue unavailable');
      useAppList(res, items, 'tv-manifests');
    });
  }
  if (!appApi || typeof appApi.getAppsInfo !== 'function') return fallback();
  try {
    appApi.getAppsInfo(function (items) {
      useAppList(res, items.map(function (a) {
        return { id: a.id, name: a.name, show: a.show, iconPath: a.iconPath };
      }), 'tizen-api');
    }, fallback);
  } catch (error) { fallback(); }
}

function launchInstalled(id, res) {
  if (!helpers.validId(id) || !knownApps[id]) return sendError(res, 400, 'App was not found in the current TV catalogue');
  var appApi = typeof tizen !== 'undefined' && tizen.application;
  if (!appApi || typeof appApi.launch !== 'function') return sendError(res, 503, 'TV launch API unavailable');
  try {
    appApi.launch(id, function () {
      send(res, 200, JSON.stringify({ ok: true }), 'application/json; charset=utf-8');
    }, function () {
      sendError(res, 403, 'Samsung blocked launching this app');
    });
  } catch (error) { sendError(res, 403, 'Samsung blocked launching this app'); }
}

function sendIcon(id, res) {
  var path = icons[id];
  if (!helpers.validId(id) || !helpers.validIcon(path)) return send(res, 404, '');
  fs.readFile(path, function (error, data) {
    if (error || !data || data.length > MAX_FILE) return send(res, 404, '');
    send(res, 200, data, /\.png$/i.test(path) ? 'image/png' : 'image/jpeg');
  });
}

function handle(req, res) {
  try {
    if (HOSTS.indexOf(req.headers.host) < 0) return send(res, 403, '');
    var route = url.parse(req.url, true);
    var origin = req.headers.origin;
    if (route.pathname === '/icon' && req.method === 'GET' && !origin) {
      return sendIcon(String(route.query.id || ''), res);
    }
    if (ORIGINS.indexOf(origin) < 0) return send(res, 403, '');
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    if (req.method === 'OPTIONS') return send(res, 204, '');
    if (route.pathname === '/apps' && req.method === 'GET') return listInstalled(res);
    if (route.pathname === '/launch' && req.method === 'POST') {
      return launchInstalled(String(route.query.id || ''), res);
    }
    if (route.pathname === '/icon' && req.method === 'GET') {
      return sendIcon(String(route.query.id || ''), res);
    }
    send(res, 404, '');
  } catch (error) { sendError(res, 500, 'FastTV service error'); }
}

// TizenBrew may evaluate the module again during launch. Reuse our port if so.
try {
  if (process.__fastTVNativeBridge) {
    process.__fastTVNativeBridge.removeAllListeners('request');
    process.__fastTVNativeBridge.on('request', handle);
  } else {
    var server = http.createServer(handle);
    server.on('error', function () { /* A blocked port must not crash TizenBrew. */ });
    server.on('clientError', function (error, socket) { try { socket.destroy(); } catch (e) { } });
    server.listen(PORT, '127.0.0.1');
    process.__fastTVNativeBridge = server;
  }
} catch (error) { /* Service is optional; the module UI still loads. */ }
