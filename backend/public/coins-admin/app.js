(function () {
  'use strict';
  var KEY = 'coinsAdminToken';
  var $ = function (id) { return document.getElementById(id); };

  function getToken() { try { return sessionStorage.getItem(KEY); } catch (e) { return null; } }
  function setToken(t) { try { if (t) sessionStorage.setItem(KEY, t); else sessionStorage.removeItem(KEY); } catch (e) { /* ignore */ } }

  function el(tag, props, children) {
    var n = document.createElement(tag);
    Object.keys(props || {}).forEach(function (k) {
      if (k === 'text') n.textContent = props[k];
      else if (k === 'class') n.className = props[k];
      else if (k.indexOf('on') === 0) n.addEventListener(k.slice(2), props[k]);
      else n.setAttribute(k, props[k]);
    });
    (children || []).forEach(function (c) { if (c) n.appendChild(c); });
    return n;
  }
  function show(node, on) { node.classList.toggle('hidden', !on); }
  function showError(id, msg) { var n = $(id); n.textContent = msg || ''; show(n, !!msg); }
  var toastTimer;
  function toast(msg) {
    var t = $('toast'); t.textContent = msg; show(t, true);
    clearTimeout(toastTimer); toastTimer = setTimeout(function () { show(t, false); }, 3000);
  }

  function showLogin(msg) {
    setToken(null);
    show($('app'), false); show($('login'), true);
    showError('loginError', msg || '');
  }

  // Calls the API. Resolves with parsed JSON; rejects with Error(server message).
  function api(method, path, body) {
    var headers = { Authorization: 'Bearer ' + getToken() };
    var opts = { method: method, headers: headers };
    if (body instanceof FormData) opts.body = body;
    else if (body !== undefined) { headers['Content-Type'] = 'application/json'; opts.body = JSON.stringify(body); }
    return fetch('/api/admin/coins' + path, opts).then(function (res) {
      return res.json().catch(function () { return {}; }).then(function (data) {
        if (res.status === 401) { showLogin('Session expired. Please sign in again.'); throw new Error('Unauthorized'); }
        if (!res.ok) throw new Error((data && data.message) || ('Request failed (' + res.status + ')'));
        return data;
      });
    });
  }

  // ---- Sign in ----
  $('loginForm').addEventListener('submit', function (e) {
    e.preventDefault();
    showError('loginError', '');
    fetch('/api/auth/login', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: $('loginEmail').value.trim(), password: $('loginPassword').value }),
    }).then(function (res) {
      return res.json().catch(function () { return {}; }).then(function (data) {
        if (!res.ok) throw new Error(data.message || 'Sign-in failed');
        var u = data.user || {};
        if (!(u.role === 'admin' && !u.adminScope)) throw new Error('Super Admin access only');
        setToken(data.token);
        $('loginPassword').value = '';
        enterApp();
      });
    }).catch(function (err) { setToken(null); showError('loginError', err.message); });
  });
  $('signOut').addEventListener('click', function () { showLogin(''); });

  function enterApp() {
    show($('login'), false); show($('app'), true);
    switchTab('settings');
  }

  // ---- Tabs ----
  function switchTab(name) {
    Array.prototype.forEach.call(document.querySelectorAll('.tab'), function (b) { b.classList.toggle('active', b.dataset.tab === name); });
    Array.prototype.forEach.call(document.querySelectorAll('.panel'), function (p) { show(p, p.id === 'tab-' + name); });
    if (name === 'settings') loadSettings();
    if (name === 'vouchers') loadVouchers();
    if (name === 'redemptions') { loadVoucherOptions().then(function () { resetRedemptions(); }); }
  }
  $('tabs').addEventListener('click', function (e) { var t = e.target.closest('.tab'); if (t) switchTab(t.dataset.tab); });

  // ---- Settings ----
  var segments = [];
  function renderSegments() {
    var body = $('segBody'); body.textContent = '';
    segments.forEach(function (seg, i) {
      var coins = el('input', { type: 'number', min: '0', step: '1' }); coins.value = seg.coins;
      var weight = el('input', { type: 'number', min: '0.01', step: 'any' }); weight.value = seg.weight;
      var pct = el('td', { text: '' });
      function pctText() {
        var t = segments.reduce(function (s, x) { var w = Number(x.weight); return s + (w > 0 ? w : 0); }, 0);
        var w = Number(seg.weight);
        pct.textContent = t > 0 && w > 0 ? (w / t * 100).toFixed(1) + '%' : '0.0%';
      }
      coins.addEventListener('input', function () { seg.coins = coins.value; });
      weight.addEventListener('input', function () { seg.weight = weight.value; refreshPcts(); });
      seg._pctUpdate = pctText;
      var rm = el('button', { class: 'btn sm danger', type: 'button', text: 'Remove', onclick: function () { segments.splice(i, 1); renderSegments(); } });
      rm.disabled = segments.length <= 4;
      body.appendChild(el('tr', {}, [el('td', { text: String(i + 1) }), el('td', {}, [coins]), el('td', {}, [weight]), pct, el('td', {}, [rm])]));
    });
    refreshPcts();
    $('addSeg').disabled = segments.length >= 8;
  }
  function refreshPcts() { segments.forEach(function (s) { if (s._pctUpdate) s._pctUpdate(); }); }
  $('addSeg').addEventListener('click', function () { if (segments.length < 8) { segments.push({ coins: 0, weight: 1 }); renderSegments(); } });

  function loadSettings() {
    showError('settingsError', '');
    api('GET', '/settings').then(function (s) {
      $('spinEnabled').checked = !!s.spinEnabled;
      $('inviteEnabled').checked = !!s.inviteEnabled;
      $('inviteReward').value = s.inviteReward;
      segments = (s.spinSegments || []).map(function (x) { return { coins: x.coins, weight: x.weight }; });
      renderSegments();
      $('settingsStamp').textContent = s.updatedAt ? 'Last saved ' + new Date(s.updatedAt).toLocaleString() : '';
    }).catch(function (err) { if (err.message !== 'Unauthorized') showError('settingsError', err.message); });
  }
  $('saveSettings').addEventListener('click', function () {
    showError('settingsError', '');
    var payload = {
      spinEnabled: $('spinEnabled').checked,
      spinSegments: segments.map(function (s) { return { coins: Number(s.coins), weight: Number(s.weight) }; }),
      inviteEnabled: $('inviteEnabled').checked,
      inviteReward: Number($('inviteReward').value),
    };
    var btn = $('saveSettings'); btn.disabled = true;
    api('PUT', '/settings', payload).then(function (s) {
      segments = s.spinSegments.map(function (x) { return { coins: x.coins, weight: x.weight }; });
      renderSegments();
      $('settingsStamp').textContent = 'Last saved ' + new Date(s.updatedAt).toLocaleString();
      toast('Settings saved');
    }).catch(function (err) { if (err.message !== 'Unauthorized') showError('settingsError', err.message); })
      .then(function () { btn.disabled = false; });
  });

  // ---- Vouchers ----
  var vouchers = [];
  function safeImgUrl(u) { return typeof u === 'string' && /^(https?:\/\/|\/)/i.test(u) ? u : null; }

  function loadVouchers() {
    showError('vouchersError', '');
    return api('GET', '/vouchers').then(function (list) { vouchers = list; renderVouchers(); })
      .catch(function (err) { if (err.message !== 'Unauthorized') showError('vouchersError', err.message); });
  }
  function renderVouchers() {
    var body = $('voucherBody'); body.textContent = '';
    vouchers.forEach(function (v) {
      var actions = el('div', { class: 'actions-cell' }, [
        el('button', { class: 'btn sm', type: 'button', text: 'Edit', onclick: function () { openVoucherModal(v); } }),
        el('button', { class: 'btn sm', type: 'button', text: 'Add codes', onclick: function () { openCodesModal(v); } }),
        el('button', { class: 'btn sm', type: 'button', text: v.isActive ? 'Deactivate' : 'Activate', onclick: function () { toggleActive(v); } }),
        el('button', { class: 'btn sm danger', type: 'button', text: 'Delete', onclick: function () { deleteVoucher(v); } }),
      ]);
      body.appendChild(el('tr', {}, [
        el('td', { text: v.title }), el('td', { text: v.category || '' }), el('td', { text: String(v.coinCost) }),
        el('td', { text: v.available + ' / ' + v.assigned }),
        el('td', {}, [el('span', { class: 'badge ' + (v.isActive ? 'on' : 'off'), text: v.isActive ? 'Active' : 'Inactive' })]),
        el('td', {}, [actions]),
      ]));
    });
    if (!vouchers.length) body.appendChild(el('tr', {}, [el('td', { colspan: '6', class: 'muted', text: 'No vouchers yet.' })]));
  }
  function toggleActive(v) {
    if (v.isActive && !window.confirm('Deactivate "' + v.title + '"? Agents will no longer see it.')) return;
    var fd = new FormData(); fd.append('isActive', v.isActive ? 'false' : 'true');
    api('PUT', '/vouchers/' + encodeURIComponent(v._id), fd).then(loadVouchers)
      .catch(function (err) { if (err.message !== 'Unauthorized') showError('vouchersError', err.message); });
  }
  function deleteVoucher(v) {
    if (!window.confirm('Delete "' + v.title + '" and all its unused codes? This cannot be undone.')) return;
    api('DELETE', '/vouchers/' + encodeURIComponent(v._id)).then(function (r) { toast(r.message || 'Deleted'); return loadVouchers(); })
      .catch(function (err) { if (err.message !== 'Unauthorized') showError('vouchersError', err.message); });
  }

  var editing = null;
  function openVoucherModal(v) {
    editing = v || null;
    showError('voucherError', '');
    $('voucherModalTitle').textContent = v ? 'Edit voucher' : 'New voucher';
    $('vTitle').value = v ? v.title : '';
    $('vBrand').value = v ? v.brand || '' : '';
    $('vCategory').value = v ? v.category || '' : '';
    $('vValueLabel').value = v ? v.valueLabel || '' : '';
    $('vCoinCost').value = v ? v.coinCost : '';
    $('vTheme').value = v ? v.theme : 'shop';
    $('vValidUntil').value = v && v.validUntil ? String(v.validUntil).slice(0, 10) : '';
    $('vSortOrder').value = v ? v.sortOrder : 0;
    $('vDescription').value = v ? v.description || '' : '';
    $('vTerms').value = v ? v.terms || '' : '';
    $('vActive').checked = v ? !!v.isActive : true;
    $('vLogo').value = '';
    var prev = $('vLogoPreview'); prev.textContent = '';
    var url = v && safeImgUrl(v.logoUrl);
    if (url) prev.appendChild(el('img', { class: 'logo-thumb', src: url, alt: 'Current logo' }));
    show($('voucherModal'), true);
  }
  $('newVoucher').addEventListener('click', function () { openVoucherModal(null); });
  $('voucherForm').addEventListener('submit', function (e) {
    e.preventDefault();
    showError('voucherError', '');
    var fd = new FormData();
    fd.append('title', $('vTitle').value);
    fd.append('brand', $('vBrand').value);
    fd.append('category', $('vCategory').value);
    fd.append('valueLabel', $('vValueLabel').value);
    fd.append('coinCost', $('vCoinCost').value);
    fd.append('theme', $('vTheme').value);
    fd.append('validUntil', $('vValidUntil').value);
    fd.append('sortOrder', $('vSortOrder').value === '' ? '0' : $('vSortOrder').value);
    fd.append('description', $('vDescription').value);
    fd.append('terms', $('vTerms').value);
    fd.append('isActive', $('vActive').checked ? 'true' : 'false');
    var file = $('vLogo').files[0];
    if (file) fd.append('logo', file);
    var wasActive = editing && editing.isActive;
    if (wasActive && !$('vActive').checked && !window.confirm('Mark this voucher inactive? Agents will no longer see it.')) return;
    var req = editing ? api('PUT', '/vouchers/' + encodeURIComponent(editing._id), fd) : api('POST', '/vouchers', fd);
    req.then(function () { show($('voucherModal'), false); toast('Voucher saved'); return loadVouchers(); })
      .catch(function (err) { if (err.message !== 'Unauthorized') showError('voucherError', err.message); });
  });

  // ---- Add codes ----
  var codesFor = null;
  function openCodesModal(v) {
    codesFor = v;
    $('codesTitle').textContent = 'Add codes: ' + v.title;
    $('codesText').value = ''; $('codesFile').value = '';
    showError('codesError', ''); show($('codesResult'), false);
    show($('codesModal'), true);
  }
  $('codesForm').addEventListener('submit', function (e) {
    e.preventDefault();
    showError('codesError', ''); show($('codesResult'), false);
    var file = $('codesFile').files[0];
    var text = $('codesText').value;
    if (!file && !text.trim()) { showError('codesError', 'Enter codes or choose an .xlsx file'); return; }
    var body;
    if (file) { body = new FormData(); body.append('file', file); } else body = { text: text };
    api('POST', '/vouchers/' + encodeURIComponent(codesFor._id) + '/codes', body).then(function (r) {
      var res = $('codesResult'); res.textContent = 'Added ' + r.added + ', skipped ' + r.skipped; show(res, true);
      $('codesText').value = ''; $('codesFile').value = '';
      loadVouchers();
    }).catch(function (err) { if (err.message !== 'Unauthorized') showError('codesError', err.message); });
  });

  Array.prototype.forEach.call(document.querySelectorAll('[data-close]'), function (b) {
    b.addEventListener('click', function () { show($('voucherModal'), false); show($('codesModal'), false); });
  });

  // ---- Redemptions ----
  var redPage = 1;
  function loadVoucherOptions() {
    return api('GET', '/vouchers').then(function (list) {
      var sel = $('rVoucher'), cur = sel.value;
      sel.textContent = '';
      sel.appendChild(el('option', { value: '', text: 'All vouchers' }));
      list.forEach(function (v) { sel.appendChild(el('option', { value: v._id, text: v.title })); });
      sel.value = cur;
    }).catch(function (err) { if (err.message !== 'Unauthorized') showError('redError', err.message); });
  }
  function fmt(d) { return d ? new Date(d).toLocaleString() : ''; }
  function resetRedemptions() { redPage = 1; $('redBody').textContent = ''; fetchRedemptions(); }
  function fetchRedemptions() {
    showError('redError', '');
    var q = [];
    function add(k, v) { if (v) q.push(k + '=' + encodeURIComponent(v)); }
    add('from', $('rFrom').value); add('to', $('rTo').value); add('voucher', $('rVoucher').value);
    add('agent', $('rAgent').value.trim()); q.push('page=' + redPage);
    api('GET', '/redemptions?' + q.join('&')).then(function (r) {
      var body = $('redBody');
      r.items.forEach(function (it) {
        var u = it.user || {}, v = it.voucher || {};
        var agent = el('td', {}, [el('div', { text: u.name || '' }), el('div', { class: 'muted small', text: u.email || '' })]);
        body.appendChild(el('tr', {}, [
          el('td', { text: fmt(it.createdAt) }), agent, el('td', { text: v.title || '' }),
          el('td', { text: String(it.coinCost) }), el('td', { text: it.code || '' }),
          el('td', { text: it.scratchedAt ? fmt(it.scratchedAt) : 'No' }),
        ]));
      });
      show($('redEmpty'), body.children.length === 0);
      show($('loadMore'), !!r.hasMore);
    }).catch(function (err) { if (err.message !== 'Unauthorized') showError('redError', err.message); });
  }
  $('redFilters').addEventListener('submit', function (e) { e.preventDefault(); resetRedemptions(); });
  $('loadMore').addEventListener('click', function () { redPage += 1; fetchRedemptions(); });

  // ---- Boot ----
  if (getToken()) enterApp(); else showLogin('');
})();
