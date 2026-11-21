(function () {
  'use strict';
  var core = window.FastTVCore;
  var demoApps = [
    { id: 'sample.tizentube', name: 'TizenTube', demo: true },
    { id: 'sample.media', name: 'Media module', demo: true }
  ];
  var state = {
    view: 'home', query: '', apps: [], favorites: [], demo: window.location.protocol === 'file:',
    modulesById: {}, socket: null, previousFocus: null, toastTimer: null
  };
  var el = {};
  function byId(id) { return document.getElementById(id); }

  function init() {
    ['clock', 'breadcrumb', 'device-label', 'section-kicker', 'section-title',
      'app-count', 'app-grid', 'empty-state', 'empty-message', 'about-card', 'search',
      'toast', 'help-overlay', 'hero', 'view-all-btn'].forEach(function (id) { el[id] = byId(id); });
    try { state.favorites = core.readFavorites(localStorage.getItem('fasttv-brew-favourites')); }
    catch (error) { state.favorites = []; }
    bindEvents();
    updateClock();
    setInterval(updateClock, 30000);
    loadApps();
    var first = document.querySelector('.nav-item.active');
    if (first) first.focus();
  }

  function updateClock() {
    el.clock.textContent = new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  }

  function toast(message) {
    el.toast.textContent = message;
    el.toast.classList.add('visible');
    clearTimeout(state.toastTimer);
    state.toastTimer = setTimeout(function () { el.toast.classList.remove('visible'); }, 3300);
  }

  function loadApps() {
    if (state.socket) {
      state.socket.onclose = null;
      state.socket.onerror = null;
      state.socket.close();
      state.socket = null;
    }
    if (state.demo) {
      el['device-label'].textContent = 'Browser preview';
      state.apps = core.normalizeApps(demoApps, '');
      render();
      toast('Preview only: sample modules. TizenBrew shows real installed modules.');
      return;
    }
    el['device-label'].textContent = 'Connecting to TizenBrew';
    state.apps = [];
    render();
    try {
      var socket = new WebSocket('ws://127.0.0.1:8081');
      state.socket = socket;
      socket.onopen = function () {
        if (state.socket !== socket) return;
        el['device-label'].textContent = 'TizenBrew connected';
        socket.send(JSON.stringify({ type: 4 }));
      };
      socket.onmessage = function (event) {
        if (state.socket !== socket) return;
        var response;
        try { response = JSON.parse(event.data); } catch (error) { return; }
        if (response.type !== 4) return;
        if (response.payload === null) {
          setTimeout(function () {
            if (state.socket === socket && socket.readyState === WebSocket.OPEN)
              socket.send(JSON.stringify({ type: 4 }));
          }, 800);
          return;
        }
        if (!Array.isArray(response.payload)) {
          toast('TizenBrew returned an unexpected modules response.');
          return;
        }
        var moduleIndex = {};
        var entries = response.payload.filter(function (mod) {
          return mod && mod.packageType === 'app' &&
            typeof mod.fullName === 'string' && typeof mod.appPath === 'string' &&
            mod.appName && String(mod.appName).toLowerCase().indexOf('fasttv') === -1;
        }).map(function (mod) {
          moduleIndex[mod.fullName] = mod;
          return { id: mod.fullName, name: String(mod.appName), iconPath: '' };
        });
        state.modulesById = moduleIndex;
        state.apps = core.normalizeApps(entries, '');
        render();
        if (!state.apps.length) toast('No other TizenBrew application modules found.');
      };
      socket.onerror = function () {
        el['device-label'].textContent = 'TizenBrew unavailable';
        toast('Cannot reach TizenBrew service. Open TizenBrew again and retry.');
      };
      socket.onclose = function () {
        if (state.socket === socket) el['device-label'].textContent = 'TizenBrew disconnected';
      };
    } catch (error) {
      el['device-label'].textContent = 'TizenBrew unavailable';
      toast('Could not connect to TizenBrew service.');
    }
  }

  function changeView(view) {
    if (['home', 'apps', 'favorites', 'about'].indexOf(view) < 0) return;
    state.view = view;
    state.query = '';
    el.search.value = '';
    render();
    var selected = document.querySelector('.nav-item[data-view="' + view + '"]');
    if (selected) selected.focus();
  }

  function bindEvents() {
    document.querySelectorAll('.nav-item').forEach(function (button) {
      button.addEventListener('click', function () { changeView(button.getAttribute('data-view')); });
    });
    byId('browse-btn').addEventListener('click', function () { changeView('apps'); });
    byId('refresh-btn').addEventListener('click', function () { loadApps(); });
    byId('view-all-btn').addEventListener('click', function () { changeView('apps'); });
    byId('empty-action').addEventListener('click', function () { changeView('apps'); });
    byId('help-btn').addEventListener('click', showHelp);
    byId('close-help').addEventListener('click', hideHelp);
    el.search.addEventListener('input', function () { state.query = el.search.value; renderCards(); });
    document.addEventListener('keydown', handleKeys);
  }

  function render() {
    var labels = { home: 'Overview', apps: 'Modules', favorites: 'Favourites', about: 'About & help' };
    el.breadcrumb.textContent = labels[state.view];
    document.querySelectorAll('.nav-item').forEach(function (button) {
      var active = button.getAttribute('data-view') === state.view;
      button.classList.toggle('active', active);
      button.setAttribute('aria-current', active ? 'page' : 'false');
    });
    el.hero.hidden = state.view !== 'home';
    el['about-card'].hidden = state.view !== 'about';
    el['view-all-btn'].hidden = state.view === 'about' || state.view === 'apps';
    el.search.parentNode.hidden = state.view === 'about';
    el['section-kicker'].textContent = state.view === 'favorites' ? 'YOUR TOP PICKS' :
      state.view === 'about' ? 'GET TO KNOW FASTTV' : 'QUICK ACCESS';
    el['section-title'].textContent = state.view === 'favorites' ? 'Favourites ' :
      state.view === 'apps' ? 'All modules ' : state.view === 'about' ? 'The essentials ' : 'Your modules ';
    el['section-title'].appendChild(el['app-count']);
    renderCards();
  }

  function renderCards() {
    el['app-grid'].textContent = '';
    if (state.view === 'about') {
      el['app-count'].textContent = '';
      el['empty-state'].hidden = true;
      return;
    }
    var apps = core.filterApps(state.apps, state.query, state.view, state.favorites);
    el['app-count'].textContent = String(apps.length);
    el['empty-state'].hidden = apps.length !== 0;
    if (!apps.length) {
      el['empty-message'].textContent = state.view === 'favorites' && !state.query ?
        'Add modules to your favourites using the star on each card.' :
        state.apps.length === 0 ? 'TizenBrew returned no application modules. Try Refresh.' :
        'No matching modules. Try a different search.';
    }
    var frag = document.createDocumentFragment();
    apps.forEach(function (app, index) { frag.appendChild(createCard(app, index)); });
    el['app-grid'].appendChild(frag);
  }

  function createCard(app, index) {
    var card = document.createElement('article');
    card.className = 'app-card';
    var launch = document.createElement('button');
    launch.className = 'app-launch focusable';
    launch.setAttribute('aria-label', 'Open module ' + app.name);
    launch.setAttribute('data-app-id', app.id);
    var avatar = document.createElement('span');
    avatar.className = 'app-avatar palette-' + (index % 6);
    avatar.textContent = (app.name.match(/[A-Za-z0-9]/g) || ['•']).slice(0, 2).join('').toUpperCase();
    if (app.iconPath && /^(file:|wgt:|https?:|\/|\.\/)/i.test(app.iconPath)) {
      var img = document.createElement('img');
      img.src = app.iconPath;
      img.alt = '';
      img.onerror = function () { if (img.parentNode) img.parentNode.removeChild(img); };
      avatar.appendChild(img);
    }
    var name = document.createElement('strong'); name.className = 'app-name'; name.textContent = app.name;
    var hint = document.createElement('small'); hint.textContent = state.demo ? 'Preview sample' : 'Open module ↗';
    launch.appendChild(avatar); launch.appendChild(name); launch.appendChild(hint);
    launch.addEventListener('click', function () { launchApp(app); });
    var fav = document.createElement('button');
    fav.className = 'fav-button focusable' + (state.favorites.indexOf(app.id) !== -1 ? ' selected' : '');
    fav.setAttribute('aria-label', (state.favorites.indexOf(app.id) !== -1 ? 'Remove ' : 'Add ') + app.name + ' favourite');
    fav.title = 'Toggle favourite';
    fav.textContent = state.favorites.indexOf(app.id) !== -1 ? '★' : '☆';
    fav.addEventListener('click', function () { favoriteApp(app.id); });
    card.appendChild(launch); card.appendChild(fav);
    return card;
  }

  function favoriteApp(id) {
    var focused = document.activeElement;
    var oldId = focused && focused.getAttribute('data-app-id');
    state.favorites = core.toggleFavorite(state.favorites, id);
    try { localStorage.setItem('fasttv-brew-favourites', JSON.stringify(state.favorites)); }
    catch (error) { toast('Unable to save favourite on this TV.'); }
    var saved = state.favorites.indexOf(id) !== -1;
    renderCards();
    var target = document.querySelector('.app-launch[data-app-id="' + cssEscape(id) + '"]');
    if (target && oldId) target.focus();
    else {
      var first = el['app-grid'].querySelector('.focusable');
      if (first) first.focus();
    }
    toast(saved ? 'Added to favourites ★' : 'Removed from favourites');
  }

  function cssEscape(value) {
    return String(value).replace(/\\/g, '\\\\').replace(/"/g, '\\"');
  }

  function launchApp(app) {
    if (state.demo || app.demo) {
      toast('Preview only. Install this GitHub module through TizenBrew to launch modules.');
      return;
    }
    try {
      var module = state.modulesById[app.id];
      var socket = state.socket;
      if (!module || !socket || socket.readyState !== WebSocket.OPEN) {
        toast('TizenBrew is disconnected. Refresh and try again.');
        return;
      }
      socket.send(JSON.stringify({ type: 5, payload: module }));
      // Mirror the TizenBrew app module navigation, never run URL JavaScript.
      if (!module.evaluateScriptOnDocumentStart &&
          /^(https?:\/\/|\/)/i.test(module.appPath)) {
        window.location.href = module.appPath;
      }
    } catch (error) { toast('Could not launch this TizenBrew module.'); }
  }

  function showHelp() {
    state.previousFocus = document.activeElement;
    el['help-overlay'].hidden = false;
    byId('close-help').focus();
  }
  function hideHelp() {
    el['help-overlay'].hidden = true;
    if (state.previousFocus && state.previousFocus.focus) state.previousFocus.focus();
  }

  function handleKeys(event) {
    var key = event.keyCode || event.which;
    if (!el['help-overlay'].hidden) {
      if (key === 10009 || key === 27 || key === 8) { event.preventDefault(); hideHelp(); }
      return;
    }
    if (key === 10009 || key === 27) {
      event.preventDefault();
      if (state.view !== 'home') changeView('home');
      else {
        if (window.history.length > 1) window.history.back();
        else toast('Press Home on the remote to return to TizenBrew.');
      }
      return;
    }
    var active = document.activeElement;
    var isInput = active && active.tagName === 'INPUT';
    if (isInput) return;
    if (key === 70 || key === 405) {
      var appId = active && (active.getAttribute('data-app-id') ||
        (active.closest('.app-card') && active.closest('.app-card').querySelector('.app-launch').getAttribute('data-app-id')));
      if (appId) { event.preventDefault(); favoriteApp(appId); }
      return;
    }
    var directions = { 37: 'left', 38: 'up', 39: 'right', 40: 'down' };
    if (!directions[key]) return;
    event.preventDefault();
    spatialMove(directions[key]);
  }

  function spatialMove(direction) {
    var buttons = Array.prototype.slice.call(document.querySelectorAll('.focusable')).filter(function (button) {
      return button.offsetParent !== null && !button.disabled && button.getBoundingClientRect().width > 0;
    });
    if (!buttons.length) return;
    var active = document.activeElement;
    if (buttons.indexOf(active) === -1) { buttons[0].focus(); return; }
    var rect = active.getBoundingClientRect();
    var x = rect.left + rect.width / 2, y = rect.top + rect.height / 2;
    var best = null, bestScore = Infinity;
    buttons.forEach(function (button) {
      if (button === active) return;
      var r = button.getBoundingClientRect();
      var dx = r.left + r.width / 2 - x, dy = r.top + r.height / 2 - y;
      var primary = direction === 'left' ? -dx : direction === 'right' ? dx : direction === 'up' ? -dy : dy;
      if (primary < 6) return;
      var cross = direction === 'left' || direction === 'right' ? Math.abs(dy) : Math.abs(dx);
      var score = primary + cross * 3;
      if (score < bestScore) { best = button; bestScore = score; }
    });
    if (best) {
      best.focus();
      if (best.scrollIntoView) best.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
}());
