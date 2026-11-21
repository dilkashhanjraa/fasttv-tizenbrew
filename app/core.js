(function (root, factory) {
  'use strict';
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.FastTVCore = api;
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  function normalizeApps(items, ownId) {
    if (!Array.isArray(items)) return [];
    var seen = {};
    return items.filter(function (app) {
      if (!app || typeof app.id !== 'string' || typeof app.name !== 'string') return false;
      if (!app.id || !app.name.trim() || app.id === ownId || app.show === false) return false;
      var key = (app.kind === 'native' ? 'native:' : 'module:') + app.id;
      if (seen[key]) return false;
      seen[key] = true;
      return true;
    }).map(function (app) {
      var kind = app.kind === 'native' ? 'native' : 'module';
      return { id: app.id, key: kind + ':' + app.id, kind: kind,
        name: app.name.trim(), iconPath: app.iconPath || '', icon: app.icon === true,
        demo: !!app.demo };
    }).sort(compareApps);
  }

  function compareApps(a, b) {
    var nameComparison = a.name.toLowerCase().localeCompare(b.name.toLowerCase());
    return nameComparison || (a.kind === 'module' ? -1 : 1);
  }

  function mergeApps(nativeApps, modules) {
    return normalizeApps([].concat(nativeApps || [], modules || []), '');
  }

  function filterApps(apps, query, view, favorites) {
    var text = String(query || '').trim().toLowerCase();
    var favs = Array.isArray(favorites) ? favorites : [];
    var filtered = apps.filter(function (app) {
      return (!text || app.name.toLowerCase().indexOf(text) !== -1) &&
        (view !== 'favorites' || favs.indexOf(app.key || app.id) !== -1 || favs.indexOf(app.id) !== -1);
    });
    if (view === 'home' && !text) {
      filtered.sort(function (a, b) {
        var favA = favs.indexOf(a.key || a.id) !== -1 || favs.indexOf(a.id) !== -1 ? 1 : 0;
        var favB = favs.indexOf(b.key || b.id) !== -1 || favs.indexOf(b.id) !== -1 ? 1 : 0;
        return favB - favA || compareApps(a, b);
      });
    }
    return filtered;
  }

  function toggleFavorite(favorites, appId) {
    var favs = Array.isArray(favorites) ? favorites.slice() : [];
    var index = favs.indexOf(appId);
    if (index >= 0) favs.splice(index, 1);
    else favs.push(appId);
    return favs;
  }

  function readFavorites(raw) {
    try {
      var data = JSON.parse(raw);
      if (!Array.isArray(data)) return [];
      return data.filter(function (value, index) {
        return typeof value === 'string' && value.length < 160 && data.indexOf(value) === index;
      }).slice(0, 150);
    } catch (error) { return []; }
  }

  return { normalizeApps: normalizeApps, mergeApps: mergeApps,
    filterApps: filterApps, toggleFavorite: toggleFavorite, readFavorites: readFavorites };
}));
