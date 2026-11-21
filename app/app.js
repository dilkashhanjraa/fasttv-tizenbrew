(function () {
  'use strict';
  var core = window.FastTVCore;
  var BRIDGE = 'http://127.0.0.1:8094';
  var previewApps = [
    {id:'preview.netflix',name:'Netflix',kind:'native',demo:true},
    {id:'preview.youtube',name:'YouTube',kind:'native',demo:true},
    {id:'preview.prime',name:'Prime Video',kind:'native',demo:true},
    {id:'preview.disney',name:'Disney+',kind:'native',demo:true},
    {id:'preview.apple',name:'Apple TV',kind:'native',demo:true},
    {id:'preview.spotify',name:'Spotify',kind:'native',demo:true},
    {id:'preview.samsung',name:'Samsung TV Plus',kind:'native',demo:true},
    {id:'preview.browser',name:'Internet',kind:'native',demo:true},
    {id:'preview.music',name:'Music',kind:'native',demo:true},
    {id:'preview.tizentube',name:'TizenTube',kind:'module',demo:true}
  ];
  var state = {
    view: 'home', query: '', nativeApps: [], modules: [], apps: [],
    favorites: [], nativeStatus: 'loading', moduleStatus: 'loading',
    demo: window.location.protocol === 'file:' || window.location.search.indexOf('demo=1') >= 0,
    moduleIndex: {}, socket: null, previousFocus: null, toastTimer: null
  };
  var el = {};
  function byId(id) { return document.getElementById(id); }

  function init() {
    ['clock', 'device-label', 'hero', 'section-kicker', 'section-title', 'section-subtitle',
      'app-grid', 'empty-state', 'empty-title', 'empty-message', 'about-card',
      'search', 'toast', 'help-overlay'].forEach(function (id) { el[id] = byId(id); });
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

  function notify(message) {
    el.toast.textContent = message;
    el.toast.classList.add('visible');
    clearTimeout(state.toastTimer);
    state.toastTimer = setTimeout(function () { el.toast.classList.remove('visible'); }, 4200);
  }

  function xhr(method, path, callback) {
    var request = new XMLHttpRequest();
    var completed = false;
    function finish(error, data) {
      if (completed) return;
      completed = true;
      callback(error, data);
    }
    try {
      request.open(method, BRIDGE + path, true);
      request.timeout = 6500;
      request.onreadystatechange = function () {
        if (request.readyState !== 4) return;
        var parsed = null;
        try { parsed = JSON.parse(request.responseText); } catch (error) { }
        finish(request.status >= 200 && request.status < 300 ? null :
          ((parsed && parsed.error) || 'TV service unavailable'), parsed);
      };
      request.onerror = function () { finish('TV service unavailable'); };
      request.ontimeout = function () { finish('TV service timed out'); };
      request.send(null);
    } catch (error) { finish('TV service unavailable'); }
  }

  function loadApps() {
    if (state.socket) {
      state.socket.onclose = null;
      state.socket.onerror = null;
      state.socket.close();
      state.socket = null;
    }
    state.nativeApps = [];
    state.modules = [];
    state.moduleIndex = {};
    state.nativeStatus = 'loading';
    state.moduleStatus = 'loading';
    if (state.demo) {
      state.nativeApps = core.normalizeApps(previewApps.filter(function (a) { return a.kind === 'native'; }), '');
      state.modules = core.normalizeApps(previewApps.filter(function (a) { return a.kind === 'module'; }), '');
      state.nativeStatus = 'demo'; state.moduleStatus = 'demo';
      updateApps();
      return;
    }
    updateApps();
    loadNative(0);
    loadModules();
  }

  function loadNative(attempt) {
    xhr('GET', '/apps', function (error, response) {
      if (error && attempt < 1) {
        // TizenBrew can start its module services shortly after the page.
        setTimeout(function () { loadNative(attempt + 1); }, 1500);
        return;
      }
      if (error || !response || !Array.isArray(response.apps)) {
        state.nativeStatus = 'unavailable';
        updateApps();
        return;
      }
      state.nativeApps = core.normalizeApps(response.apps.map(function (item) {
        return { id: item.id, name: item.name, show: item.show, kind: 'native', icon: item.icon === true };
      }), '');
      state.nativeStatus = 'ready';
      updateApps();
    });
  }

  function loadModules() {
    try {
      var socket = new WebSocket('ws://127.0.0.1:8081');
      state.socket = socket;
      var retry = 0;
      socket.onopen = function () {
        if (state.socket === socket) socket.send(JSON.stringify({ type: 4 }));
      };
      socket.onmessage = function (event) {
        if (state.socket !== socket) return;
        var response;
        try { response = JSON.parse(event.data); } catch (error) { return; }
        if (response.type !== 4) return;
        if (response.payload === null && retry++ < 4) {
          setTimeout(function () {
            if (state.socket === socket && socket.readyState === WebSocket.OPEN)
              socket.send(JSON.stringify({ type: 4 }));
          }, 800);
          return;
        }
        if (!Array.isArray(response.payload)) {
          state.moduleStatus = 'unavailable';
          updateApps();
          return;
        }
        var index = {}, modules = [];
        response.payload.forEach(function (mod) {
          if (!mod || typeof mod.fullName !== 'string' || !mod.appName ||
              !/^(app|mods)$/.test(mod.packageType) ||
              String(mod.appName).toLowerCase().indexOf('fasttv') >= 0) return;
          index[mod.fullName] = mod;
          modules.push({id:mod.fullName,name:String(mod.appName),kind:'module'});
        });
        state.moduleIndex = index;
        state.modules = core.normalizeApps(modules, '');
        state.moduleStatus = 'ready';
        updateApps();
      };
      socket.onerror = function () {
        if (state.socket !== socket) return;
        state.moduleStatus = 'unavailable';
        updateApps();
      };
      socket.onclose = function () {
        if (state.socket !== socket) return;
        if (state.moduleStatus === 'loading') state.moduleStatus = 'unavailable';
        updateApps();
      };
    } catch (error) {
      state.moduleStatus = 'unavailable';
      updateApps();
    }
  }

  function updateApps() {
    state.apps = core.mergeApps(state.nativeApps, state.modules);
    if (state.demo) el['device-label'].textContent = 'Visual preview';
    else if (state.nativeStatus === 'ready') el['device-label'].textContent = 'TV apps connected';
    else if (state.moduleStatus === 'ready') el['device-label'].textContent = 'TizenBrew connected';
    else if (state.nativeStatus === 'loading' || state.moduleStatus === 'loading')
      el['device-label'].textContent = 'Finding your apps';
    else el['device-label'].textContent = 'App discovery limited';
    render();
  }

  function changeView(view) {
    if (['home', 'apps', 'favorites', 'about'].indexOf(view) < 0) return;
    state.view = view;
    state.query = '';
    el.search.value = '';
    render();
    var selected = document.querySelector('.nav-item[data-view="' + view + '"]');
    if (selected) selected.focus();
    byId('main-content').scrollTop = 0;
  }

  function bindEvents() {
    document.querySelectorAll('.nav-item').forEach(function (button) {
      button.addEventListener('click', function () { changeView(button.getAttribute('data-view')); });
    });
    byId('browse-btn').addEventListener('click', function () { changeView('apps'); });
    byId('hero-refresh').addEventListener('click', loadApps);
    byId('refresh-btn').addEventListener('click', loadApps);
    byId('empty-action').addEventListener('click', loadApps);
    byId('help-btn').addEventListener('click', showHelp);
    byId('close-help').addEventListener('click', hideHelp);
    el.search.addEventListener('input', function () {
      state.query = el.search.value;
      renderCards();
    });
    document.addEventListener('keydown', handleKeys);
  }

  function render() {
    document.querySelectorAll('.nav-item').forEach(function (button) {
      var active = button.getAttribute('data-view') === state.view;
      button.classList.toggle('active', active);
      button.setAttribute('aria-current', active ? 'page' : 'false');
    });
    el.hero.hidden = state.view !== 'home';
    el['about-card'].hidden = state.view !== 'about';
    el.search.parentNode.hidden = state.view === 'about';
    el['section-kicker'].textContent = state.view === 'favorites' ? 'JUST FOR YOU' :
      state.view === 'about' ? 'GET TO KNOW FASTTV' : 'READY WHEN YOU ARE';
    el['section-title'].textContent = state.view === 'favorites' ? 'Your Favourites' :
      state.view === 'about' ? 'Welcome to FastTV' :
      state.view === 'apps' ? 'All Apps' : 'Your Apps';
    var n = state.nativeApps.length, m = state.modules.length;
    el['section-subtitle'].textContent = state.demo ?
      'Preview layout with sample app names — TV apps will be discovered on your Samsung.' :
      n + ' TV apps' + (m ? '  ·  ' + m + ' TizenBrew modules' : '') +
      (state.nativeStatus === 'unavailable' ? '  ·  Samsung app access unavailable' : '');
    renderCards();
  }

  function renderCards() {
    el['app-grid'].textContent = '';
    if (state.view === 'about') {
      el['empty-state'].hidden = true;
      return;
    }
    var apps = core.filterApps(state.apps, state.query, state.view, state.favorites);
    el['empty-state'].hidden = apps.length > 0;
    if (!apps.length) {
      var pending = state.nativeStatus === 'loading' || state.moduleStatus === 'loading';
      el['empty-title'].textContent = pending ? 'Finding your apps…' :
        state.view === 'favorites' ? 'Your favourites will be here' :
        state.query ? 'No matching apps' : 'No apps found yet';
      el['empty-message'].textContent = pending ? 'FastTV is asking the TV for its installed apps.' :
        state.view === 'favorites' ? 'Choose the ☆ on an app tile to pin it here.' :
        state.query ? 'Try another app name.' :
        'Samsung may be blocking the app list. Try Sync TV apps. TizenBrew modules will still appear when available.';
      byId('empty-action').hidden = pending || state.view === 'favorites' || !!state.query;
      return;
    }
    var frag = document.createDocumentFragment();
    apps.forEach(function (app, index) { frag.appendChild(createCard(app, index)); });
    el['app-grid'].appendChild(frag);
  }

  function skin(name, index) {
    var lower = name.toLowerCase();
    if (lower.indexOf('netflix') >= 0) return 'skin-netflix';
    if (lower.indexOf('youtube') >= 0) return 'skin-youtube';
    if (lower.indexOf('tizentube') >= 0) return 'skin-tizentube';
    if (lower.indexOf('prime') >= 0) return 'skin-prime';
    if (lower.indexOf('disney') >= 0) return 'skin-disney';
    if (lower.indexOf('spotify') >= 0) return 'skin-spotify';
    if (lower.indexOf('apple') >= 0) return 'skin-apple';
    if (lower.indexOf('samsung') >= 0) return 'skin-samsung';
    if (lower.indexOf('internet') >= 0 || lower.indexOf('browser') >= 0) return 'skin-browser';
    return 'skin-' + (index % 6);
  }

  function isFavorite(app) {
    return state.favorites.indexOf(app.key) !== -1 || state.favorites.indexOf(app.id) !== -1;
  }

  function createCard(app, index) {
    var card = document.createElement('article');
    card.className = 'app-card ' + skin(app.name, index);
    var launch = document.createElement('button');
    launch.className = 'app-launch focusable';
    launch.setAttribute('aria-label', 'Open ' + app.name);
    launch.setAttribute('data-app-key', app.key);
    var art = document.createElement('div');
    art.className = 'tile-art';
    var kind = document.createElement('span');
    kind.className = 'tile-kind';
    kind.textContent = state.demo ? 'PREVIEW' : app.kind === 'native' ? 'SAMSUNG TV' : 'TIZENBREW';
    art.appendChild(kind);
    var lettering = document.createElement('span');
    lettering.className = 'tile-letter';
    var firstWord = app.name.split(/[\s+]/)[0];
    lettering.textContent = firstWord.length < 11 ? firstWord : firstWord.slice(0, 8);
    if (firstWord.length > 5) lettering.className += ' long';
    art.appendChild(lettering);
    if (app.kind === 'native' && app.icon) {
      var icon = document.createElement('img');
      icon.alt = '';
      icon.src = BRIDGE + '/icon?id=' + encodeURIComponent(app.id);
      icon.onerror = function () { if (icon.parentNode) icon.parentNode.removeChild(icon); };
      art.appendChild(icon);
    }
    var title = document.createElement('div');
    title.className = 'tile-label';
    var strong = document.createElement('strong');
    strong.textContent = app.name;
    title.appendChild(strong);
    var caption = document.createElement('div');
    caption.className = 'tile-caption';
    caption.textContent = app.kind === 'native' ? 'TV application' : 'TizenBrew module';
    launch.appendChild(art);
    launch.appendChild(title);
    launch.appendChild(caption);
    launch.addEventListener('click', function () { launchApp(app); });
    var fav = document.createElement('button');
    fav.className = 'fav-button focusable' + (isFavorite(app) ? ' selected' : '');
    fav.setAttribute('aria-label', (isFavorite(app) ? 'Remove ' : 'Add ') + app.name + ' favourite');
    fav.textContent = isFavorite(app) ? '★' : '☆';
    fav.addEventListener('click', function () { favoriteApp(app); });
    card.appendChild(launch);
    card.appendChild(fav);
    return card;
  }

  function favoriteApp(app) {
    var focused = document.activeElement;
    var oldKey = focused && focused.getAttribute('data-app-key');
    var current = state.favorites.filter(function (x) { return x !== app.id; });
    if (state.favorites.indexOf(app.id) !== -1 && current.indexOf(app.key) === -1) {
      // An old FastTV 1.0 favourite was stored without a source prefix.
      state.favorites = current;
    } else state.favorites = core.toggleFavorite(current, app.key);
    try { localStorage.setItem('fasttv-brew-favourites', JSON.stringify(state.favorites)); }
    catch (error) { notify('This TV could not save your favourite.'); }
    renderCards();
    var key = oldKey || app.key;
    var buttons = document.querySelectorAll('.app-launch');
    for (var i = 0; i < buttons.length; i++) {
      if (buttons[i].getAttribute('data-app-key') === key) { buttons[i].focus(); break; }
    }
    notify(isFavorite(app) ? 'Added to favourites ★' : 'Removed from favourites');
  }

  function launchApp(app) {
    if (state.demo || app.demo) {
      notify('Preview only. Installed apps can be opened from FastTV on your Samsung TV.');
      return;
    }
    if (app.kind === 'native') {
      xhr('POST', '/launch?id=' + encodeURIComponent(app.id), function (error) {
        if (error) notify(error + '. You can still use the TV Home screen.');
      });
      return;
    }
    var module = state.moduleIndex[app.id];
    var socket = state.socket;
    if (!module || !socket || socket.readyState !== WebSocket.OPEN) {
      notify('TizenBrew is disconnected. Sync TV apps and try again.');
      return;
    }
    try {
      socket.send(JSON.stringify({ type: 5, payload: module }));
      if (!module.evaluateScriptOnDocumentStart && typeof module.appPath === 'string' &&
          /^(https?:\/\/|\/)/i.test(module.appPath)) window.location.href = module.appPath;
    } catch (error) { notify('Could not open that TizenBrew module.'); }
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
      else notify('Use the TV Home button to leave FastTV.');
      return;
    }
    var active = document.activeElement;
    if (active && active.tagName === 'INPUT') return;
    if (key === 70 || key === 405) {
      var card = active && active.closest && active.closest('.app-card');
      var target = card && card.querySelector('.app-launch');
      if (target) {
        var appKey = target.getAttribute('data-app-key');
        state.apps.forEach(function (app) {
          if (app.key === appKey) { event.preventDefault(); favoriteApp(app); }
        });
      }
      return;
    }
    var directions = {37:'left',38:'up',39:'right',40:'down'};
    if (!directions[key]) return;
    event.preventDefault();
    spatialMove(directions[key]);
  }

  function spatialMove(direction) {
    var buttons = Array.prototype.slice.call(document.querySelectorAll('.focusable')).filter(function (b) {
      return b.offsetParent !== null && !b.disabled && b.getBoundingClientRect().width > 0;
    });
    if (!buttons.length) return;
    var active = document.activeElement;
    if (buttons.indexOf(active) < 0) { buttons[0].focus(); return; }
    var rect = active.getBoundingClientRect();
    var x = rect.left + rect.width / 2, y = rect.top + rect.height / 2, best = null, score = Infinity;
    buttons.forEach(function (button) {
      if (button === active) return;
      var r = button.getBoundingClientRect();
      var dx = r.left + r.width / 2 - x, dy = r.top + r.height / 2 - y;
      var forward = direction === 'left' ? -dx : direction === 'right' ? dx :
        direction === 'up' ? -dy : dy;
      if (forward < 6) return;
      var cross = direction === 'left' || direction === 'right' ? Math.abs(dy) : Math.abs(dx);
      var value = forward + cross * 3;
      if (value < score) { best = button; score = value; }
    });
    if (best) {
      best.focus();
      if (best.scrollIntoView) best.scrollIntoView({block:'nearest',inline:'nearest'});
    }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
}());
