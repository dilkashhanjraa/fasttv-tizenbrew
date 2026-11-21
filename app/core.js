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
      if (seen[app.id]) return false;
      seen[app.id] = true;
      return true;
    }).map(function (app) {
      return { id: app.id, name: app.name.trim(), iconPath: app.iconPath || '', demo: !!app.demo };
    }).sort(function (a, b) { return a.name.toLowerCase().localeCompare(b.name.toLowerCase()); });
  }

  function filterApps(apps, query, view, favorites) {
    var text = String(query || '').trim().toLowerCase();
    var favs = Array.isArray(favorites) ? favorites : [];
    var filtered = apps.filter(function (app) {
      return (!text || app.name.toLowerCase().indexOf(text) !== -1) &&
        (view !== 'favorites' || favs.indexOf(app.id) !== -1);
    });
    if (view === 'home' && !text) {
      filtered.sort(function (a, b) {
        var favA = favs.indexOf(a.id) !== -1 ? 1 : 0;
        var favB = favs.indexOf(b.id) !== -1 ? 1 : 0;
        return favB - favA || a.name.toLowerCase().localeCompare(b.name.toLowerCase());
      });
      return filtered.slice(0, 12);
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

  return { normalizeApps: normalizeApps, filterApps: filterApps, toggleFavorite: toggleFavorite, readFavorites: readFavorites };
}));
