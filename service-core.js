// Pure helpers for FastTV's optional TV-app discovery service.
// ES5-compatible for older Samsung TizenBrew service runtimes.
'use strict';

var ID_PATTERN = /^[A-Za-z0-9._-]{1,128}$/;

function validId(value) {
  return typeof value === 'string' && ID_PATTERN.test(value);
}

function validIcon(value) {
  return typeof value === 'string' &&
    /^\/(?:opt|usr)\/[A-Za-z0-9._/-]+\.(?:png|jpg|jpeg)$/i.test(value) &&
    value.indexOf('..') < 0 && value.length <= 350;
}

function attribute(tag, key) {
  var pattern = new RegExp('\\b' + key.replace(':', '\\:') + '\\s*=\\s*(["\\x27])(.*?)\\1', 'i');
  var match = pattern.exec(tag);
  return match ? match[2] : '';
}

function decode(value) {
  return String(value || '').replace(/&(?:amp|lt|gt|quot|apos|#(\d+));/g, function (entity, number) {
    if (number) {
      var code = parseInt(number, 10);
      return code > 31 && code < 65536 ? String.fromCharCode(code) : '';
    }
    return { '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&apos;': "'" }[entity] || entity;
  });
}

function parseManifest(xml) {
  if (typeof xml !== 'string' || xml.length > 2097152) return [];
  var apps = [], found = {};
  var ui = /<ui-application\b([^>]*?)(?:\/>|>([\s\S]*?)<\/ui-application>)/ig;
  var match;
  while ((match = ui.exec(xml)) && apps.length < 250) {
    var id = attribute(match[1], 'appid');
    if (!validId(id) || attribute(match[1], 'nodisplay').toLowerCase() === 'true' || found[id]) continue;
    found[id] = true;
    var body = match[2] || '';
    var labels = /<label\b([^>]*)>([^<]*)<\/label>/ig;
    var label, chosen = '', english = '';
    while ((label = labels.exec(body))) {
      var text = decode(label[2]).trim();
      if (!text) continue;
      if (!chosen) chosen = text;
      if (/^en(?:[-_]|$)/i.test(attribute(label[1], 'xml:lang'))) english = text;
      if (!attribute(label[1], 'xml:lang')) { chosen = text; break; }
    }
    var iconMatch = /<icon\b[^>]*>([^<]*)<\/icon>/i.exec(body);
    var iconPath = iconMatch ? decode(iconMatch[1]).trim() : '';
    apps.push({ id: id, name: english || chosen || id, show: true,
      iconPath: validIcon(iconPath) ? iconPath : '' });
  }
  return apps;
}

module.exports = { validId: validId, validIcon: validIcon, parseManifest: parseManifest };
