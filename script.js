(function(){
"use strict";

/* ---------------- service worker: app shell works offline ---------------- */
if('serviceWorker' in navigator){
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  });
}

/* ---------------- installable PWA prompt ---------------- */
let deferredInstallPrompt = null;
const installBar = document.getElementById('installBar');
const installBtn = document.getElementById('installBtn');
const installDismiss = document.getElementById('installDismiss');

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  if(localStorage.getItem('rp_install_dismissed') === '1') return;
  deferredInstallPrompt = e;
  if(installBar){ installBar.hidden = false; installBar.style.display = 'flex'; }
});
installBtn?.addEventListener('click', async () => {
  if(!deferredInstallPrompt) return;
  deferredInstallPrompt.prompt();
  await deferredInstallPrompt.userChoice;
  deferredInstallPrompt = null;
  if(installBar){ installBar.hidden = true; installBar.style.display = 'none'; }
});
installDismiss?.addEventListener('click', () => {
  if(installBar){ installBar.hidden = true; installBar.style.display = 'none'; }
  localStorage.setItem('rp_install_dismissed', '1');
});
window.addEventListener('appinstalled', () => {
  if(installBar){ installBar.hidden = true; installBar.style.display = 'none'; }
});

/* ---------------- online/offline banner ---------------- */
const netBanner = document.getElementById('netBanner');
function updateNetBanner(){
  if(navigator.onLine){
    netBanner.textContent = '● Back online';
    netBanner.className = 'net-banner show online';
    setTimeout(() => netBanner.classList.remove('show'), 2500);
  } else {
    netBanner.textContent = '● Offline — showing last known data where available';
    netBanner.className = 'net-banner show offline';
  }
}
window.addEventListener('online', updateNetBanner);
window.addEventListener('offline', updateNetBanner);
if(!navigator.onLine) updateNetBanner();

function showToast(msg){
  let t = document.getElementById('delayToast');
  if(!t){
    t = document.createElement('div');
    t.id = 'delayToast';
    t.className = 'delay-toast';
    document.body.appendChild(t);
  }
  t.textContent = msg;
  requestAnimationFrame(() => t.classList.add('show'));
  clearTimeout(t._hideTimer);
  t._hideTimer = setTimeout(() => t.classList.remove('show'), 5000);
}
function beep(){
  try{
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = 'sine'; o.frequency.value = 880;
    g.gain.setValueAtTime(0.001, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.15, ctx.currentTime + 0.01);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
    o.connect(g); g.connect(ctx.destination);
    o.start(); o.stop(ctx.currentTime + 0.3);
  }catch(e){}
}

/* ---------------- tabs with sliding indicator ---------------- */
const tabs = document.querySelectorAll('.tab');
const panels = document.querySelectorAll('.panel');
const indicator = document.getElementById('tabIndicator');
function positionIndicator(el){
  if(!el || el.offsetParent === null) return; // tabs row is visually hidden now
  indicator.style.left = el.offsetLeft + 'px';
  indicator.style.width = el.offsetWidth + 'px';
}
let currentTab = 'live';
let lastNonLiveTab = 'between';
function activateTab(tabKey){
  if(currentTab !== 'live' && currentTab !== tabKey) lastNonLiveTab = currentTab;
  currentTab = tabKey;
  tabs.forEach(x => x.classList.toggle('active', x.dataset.tab === tabKey));
  panels.forEach(x => x.classList.toggle('active', x.id === 'panel-' + tabKey));
  document.querySelectorAll('.quick-tile').forEach(x => x.classList.toggle('active', x.dataset.tab === tabKey));
  positionIndicator(document.querySelector('.tab.active'));
}
tabs.forEach(t => t.addEventListener('click', () => activateTab(t.dataset.tab)));
document.querySelectorAll('.quick-tile').forEach(t => t.addEventListener('click', () => activateTab(t.dataset.tab)));
window.addEventListener('load', () => positionIndicator(document.querySelector('.tab.active')));
window.addEventListener('resize', () => positionIndicator(document.querySelector('.tab.active')));

/* ---------------- quick-tile icons ---------------- */
window.addEventListener('DOMContentLoaded', () => {
  const qiLive = document.getElementById('qiLive');
  const qiPnr = document.getElementById('qiPnr');
  const qiBetween = document.getElementById('qiBetween');
  if(qiLive) qiLive.innerHTML = `<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="1.7"><rect x="5" y="4" width="14" height="12" rx="3"/><path d="M5 11h14M9 16l-2 4M15 16l2 4"/></svg>`;
  if(qiPnr) qiPnr.innerHTML = `<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M4 7a2 2 0 012-2h12a2 2 0 012 2v2a2 2 0 000 4v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2a2 2 0 000-4V7z"/><path d="M9 5v14" stroke-dasharray="2 3"/></svg>`;
  if(qiBetween) qiBetween.innerHTML = `<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="1.7"><circle cx="6" cy="6" r="2.2"/><circle cx="18" cy="18" r="2.2"/><path d="M8 7l8 10M13 7h3v3"/></svg>`;
});

/* ---------------- dark/light theme toggle ---------------- */
const themeToggle = document.getElementById('themeToggle');
function applyTheme(t){
  document.documentElement.setAttribute('data-theme', t);
  localStorage.setItem('rp_theme', t);
  const metaTheme = document.querySelector('meta[name="theme-color"]');
  if(metaTheme) metaTheme.setAttribute('content', t === 'dark' ? '#161b2e' : '#2f6ef2');
}
const savedTheme = localStorage.getItem('rp_theme')
  || (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
applyTheme(savedTheme);
themeToggle?.addEventListener('click', () => {
  applyTheme(document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark');
});

/* ---------------- ripple micro-interaction (tiles + buttons) ---------------- */
function addRipple(el){
  el.addEventListener('click', function(e){
    const rect = this.getBoundingClientRect();
    const size = Math.max(rect.width, rect.height) * 1.6;
    const ripple = document.createElement('span');
    ripple.className = 'ripple';
    ripple.style.width = ripple.style.height = size + 'px';
    ripple.style.left = (e.clientX - rect.left - size/2) + 'px';
    ripple.style.top = (e.clientY - rect.top - size/2) + 'px';
    this.appendChild(ripple);
    setTimeout(() => ripple.remove(), 550);
  });
}
document.querySelectorAll('.quick-tile, .btn').forEach(addRipple);
function loadList(key){
  try { return JSON.parse(localStorage.getItem(key) || '[]'); } catch(e){ return []; }
}
function saveList(key, arr){ localStorage.setItem(key, JSON.stringify(arr)); }
function pushRecent(key, value, max = 6){
  let list = loadList(key).filter(v => v !== value);
  list.unshift(value);
  if(list.length > max) list = list.slice(0, max);
  saveList(key, list);
  return list;
}
function toggleFavorite(key, value){
  let list = loadList(key);
  if(list.includes(value)) list = list.filter(v => v !== value);
  else list.unshift(value);
  saveList(key, list);
  return list;
}
function renderChips(container, list, onClick, isFav){
  container.innerHTML = list.map(v =>
    `<span class="chip${isFav ? ' fav' : ''}" data-v="${escapeHtml(v)}">${escapeHtml(v)}</span>`
  ).join('');
  container.querySelectorAll('.chip').forEach(c => {
    c.addEventListener('click', () => onClick(c.dataset.v));
  });
}

/* ---------------- quota counter (session-only, informational) ---------------- */
let quotaUsed = Number(sessionStorage.getItem('rp_quota') || 0);
const quotaEl = document.getElementById('quotaCount');
function bumpQuota(){
  quotaUsed++;
  sessionStorage.setItem('rp_quota', quotaUsed);
  quotaEl.textContent = quotaUsed;
}
quotaEl.textContent = quotaUsed;

/* ---------------- generic cached fetch (session cache + durable offline fallback) ---------------- */
async function cachedFetch(key, url){
  const cached = sessionStorage.getItem(key);
  if(cached){
    try { return { data: JSON.parse(cached), fromCache: true, offline: false }; } catch(e){ /* fall through */ }
  }

  const offlineKey = 'rp_offline_' + key;
  if(!navigator.onLine){
    const saved = localStorage.getItem(offlineKey);
    if(saved){
      const parsed = JSON.parse(saved);
      return { data: parsed.data, fromCache: true, offline: true, savedAt: parsed.savedAt };
    }
    throw new Error("You're offline and no earlier result is saved for this.");
  }

  try{
    const res = await fetch(url);
    const json = await res.json();
    if(!res.ok || json.ok === false){
      throw new Error(json.error || ('Request failed (' + res.status + ')'));
    }
    bumpQuota();
    sessionStorage.setItem(key, JSON.stringify(json.data));
    localStorage.setItem(offlineKey, JSON.stringify({ data: json.data, savedAt: Date.now() }));
    return { data: json.data, fromCache: false, offline: false };
  }catch(err){
    const saved = localStorage.getItem(offlineKey);
    if(saved){
      const parsed = JSON.parse(saved);
      return { data: parsed.data, fromCache: true, offline: true, savedAt: parsed.savedAt, networkFailed: true };
    }
    throw err;
  }
}

function timeAgo(ts){
  const mins = Math.round((Date.now() - ts) / 60000);
  if(mins < 1) return 'just now';
  if(mins < 60) return mins + ' min ago';
  const hrs = Math.round(mins/60);
  if(hrs < 24) return hrs + ' hr ago';
  return Math.round(hrs/24) + ' day(s) ago';
}

function setStatus(container, msg, isError){
  container.innerHTML = `<div class="status-msg${isError ? ' error' : ''}">${msg}</div>`;
}
function showSkeleton(container){
  container.innerHTML = `<div class="skeleton">
    <div class="sk-line w40"></div>
    <div class="sk-line w60"></div>
    <div class="sk-line w100"></div>
  </div>`;
}

/* ---------------- deep field lookup (defensive against API shape variance) ---------------- */
function pick(obj, paths, fallback){
  for(const p of paths){
    const parts = p.split('.');
    let cur = obj;
    let ok = true;
    for(const part of parts){
      if(cur && typeof cur === 'object' && part in cur){ cur = cur[part]; }
      else { ok = false; break; }
    }
    if(ok && cur !== undefined && cur !== null && cur !== '') return cur;
  }
  return fallback;
}
function escapeHtml(s){
  return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

/* ---------------- clean line-icon set (no platform emoji) ---------------- */
const ICONS = {
  star: (filled) => `<svg viewBox="0 0 24 24" width="14" height="14" fill="${filled ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="1.6"><path d="M12 3.5l2.6 5.6 6 .7-4.5 4.1 1.2 6-5.3-3.1-5.3 3.1 1.2-6-4.5-4.1 6-.7z" stroke-linejoin="round"/></svg>`,
  pin: `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M12 21s7-6.1 7-11.3A7 7 0 105 9.7C5 14.9 12 21 12 21z" stroke-linejoin="round"/><circle cx="12" cy="9.5" r="2.3"/></svg>`,
  train: `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.7"><rect x="5" y="4" width="14" height="12" rx="3"/><path d="M5 11h14M9 16l-2 4M15 16l2 4M9 7h6"/><circle cx="8.5" cy="14" r=".4" fill="currentColor"/><circle cx="15.5" cy="14" r=".4" fill="currentColor"/></svg>`,
  clipboard: `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="6" y="4" width="12" height="17" rx="2"/><path d="M9 4V3a1 1 0 011-1h4a1 1 0 011 1v1" stroke-linecap="round"/><path d="M9 11h6M9 15h6" stroke-linecap="round"/></svg>`,
  check: `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 12.5l4.5 4.5L19 7" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  whatsapp: `<svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><path d="M17.5 14.4c-.3-.1-1.6-.8-1.9-.9-.3-.1-.4-.1-.6.1-.2.3-.7.9-.8 1-.2.2-.3.2-.5.1-.3-.1-1.2-.4-2.2-1.4-.8-.7-1.4-1.6-1.5-1.9-.2-.3 0-.5.1-.6l.4-.5c.1-.1.2-.3.2-.4.1-.2 0-.3 0-.4l-.7-1.7c-.2-.4-.4-.4-.6-.4h-.5c-.2 0-.4.1-.6.3-.2.2-.8.8-.8 2s.9 2.3 1 2.4c.1.2 1.7 2.6 4.2 3.6.6.2 1 .4 1.4.5.6.2 1.1.1 1.5.1.5-.1 1.6-.6 1.8-1.3.2-.6.2-1.1.2-1.2-.1-.1-.2-.2-.5-.3z"/><path d="M12 3a9 9 0 00-7.7 13.6L3 21l4.5-1.2A9 9 0 1012 3z" stroke="currentColor" stroke-width="1.4" fill="none"/></svg>`
};
function iconLabel(icon, text){
  return `<span style="display:inline-flex;align-items:center;gap:6px;vertical-align:middle;">${icon}${text}</span>`;
}

/* ---------------- unified history (across all 3 features) ---------------- */
function pushHistory(type, value, label){
  let hist = loadList('rp_history');
  hist = hist.filter(h => !(h.type === type && h.value === value));
  hist.unshift({ type, value, label: label || value, ts: Date.now() });
  if(hist.length > 10) hist = hist.slice(0, 10);
  saveList('rp_history', hist);
  renderHistory();
}
const HIST_ICONS = { live: ICONS.train, pnr: ICONS.clipboard, between: ICONS.pin };
const HIST_LABELS = { live: 'Train', pnr: 'PNR', between: 'Route' };
function deleteHistoryItem(index){
  const item = document.querySelector(`.history-item[data-i="${index}"]`);
  let hist = loadList('rp_history');
  hist.splice(index, 1);
  saveList('rp_history', hist);
  if(item){
    item.classList.add('removing');
    setTimeout(renderHistory, 250);
  } else {
    renderHistory();
  }
}
function renderHistory(){
  const list = loadList('rp_history');
  const el = document.getElementById('historyList');
  if(!el) return;
  if(!list.length){
    el.innerHTML = '<div class="history-empty">Your recent searches will show up here.</div>';
    return;
  }
  el.innerHTML = list.map((h, i) => `
    <div class="history-item" data-i="${i}">
      <span class="h-icon">${HIST_ICONS[h.type] || ''}</span>
      <span class="h-text">${escapeHtml(h.label)}</span>
      <span class="h-type">${HIST_LABELS[h.type] || ''}</span>
      <button class="h-del" data-i="${i}" aria-label="Remove"><svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 6l12 12M18 6L6 18" stroke-linecap="round"/></svg></button>
    </div>`).join('');
  el.querySelectorAll('.h-del').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      deleteHistoryItem(Number(btn.dataset.i));
    });
  });
  el.querySelectorAll('.history-item').forEach(row => {
    row.addEventListener('click', () => {
      const h = list[Number(row.dataset.i)];
      if(!h) return;
      if(h.type === 'live'){
        activateTab('live');
        document.getElementById('liveTrainNo').value = h.value;
        syncFavBtn();
        runLiveStatus(h.value);
      } else if(h.type === 'pnr'){
        activateTab('pnr');
        document.getElementById('pnrInput').value = h.value;
        runPnrCheck(h.value);
      } else if(h.type === 'between'){
        activateTab('between');
        const [f, t] = h.value.split('→');
        document.getElementById('fromStation').value = f;
        document.getElementById('toStation').value = t;
        runBetweenSearch();
      }
    });
  });
}

/* ================= LIVE STATUS ================= */
const liveResult = document.getElementById('liveResult');
const liveInput = document.getElementById('liveTrainNo');
const liveFavBtn = document.getElementById('liveFavBtn');
const liveFavChips = document.getElementById('liveFavChips');
const liveRecentChips = document.getElementById('liveRecentChips');

/* ---------------- crowdsourced live GPS (Supabase) ---------------- */
const SUPABASE_URL = 'https://fvzabpxkxmcmxtwthfot.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ2emFicHhreG1jbXh0d3RoZm90Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODk4MDU4MzUsImV4cCI6MjEwNTM4MTgzNX0._lI-ZgW_qHoZ3lHDaGticUHNif2wYbaLD8zn4aarSN8';

async function reportPosition(trainNo, lat, lng){
  try{
    await fetch(`${SUPABASE_URL}/rest/v1/train_positions`, {
      method: 'POST',
      headers: {
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=minimal'
      },
      body: JSON.stringify({ train_no: trainNo, lat, lng })
    });
  }catch(e){ /* silent — best effort, never blocks the UI */ }
}

async function fetchLatestPosition(trainNo){
  try{
    const since = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    const url = `${SUPABASE_URL}/rest/v1/train_positions?train_no=eq.${trainNo}&reported_at=gte.${since}&order=reported_at.desc&limit=1`;
    const res = await fetch(url, {
      headers: { 'apikey': SUPABASE_ANON_KEY, 'Authorization': `Bearer ${SUPABASE_ANON_KEY}` }
    });
    if(!res.ok) return null;
    const rows = await res.json();
    return rows[0] || null;
  }catch(e){ return null; }
}

let crowdMapInstance = null;
async function loadCrowdMap(trainNo){
  const wrap = document.getElementById('crowdMapWrap');
  if(!wrap) return;
  const row = await fetchLatestPosition(trainNo);
  if(!document.getElementById('crowdMapWrap')) return; // panel changed while we were fetching

  if(!row){
    wrap.innerHTML = `<div class="crowd-map-empty">
      No live rider reports for this train yet in the last 10 minutes.
      <label class="crowd-empty-cta">
        <input type="checkbox" id="gpsShareToggleInline">
        Be the first — share your location
      </label>
    </div>`;
    document.getElementById('gpsShareToggleInline')?.addEventListener('change', function(){
      gpsShareToggle.checked = this.checked;
      gpsShareToggle.dispatchEvent(new Event('change'));
    });
    return;
  }

  const ageSec = Math.max(0, Math.round((Date.now() - new Date(row.reported_at).getTime()) / 1000));
  const ageText = ageSec < 60 ? `${ageSec}s ago` : `${Math.round(ageSec/60)}m ago`;

  wrap.innerHTML = `
    <div class="crowd-map-badge">${iconLabel(ICONS.pin, `Live rider position · updated ${ageText}`)}</div>
    <div id="crowdMapEl" class="crowd-map-el"></div>`;

  if(typeof L === 'undefined'){
    document.getElementById('crowdMapEl').outerHTML = '<div class="crowd-map-empty">Map library failed to load.</div>';
    return;
  }
  if(crowdMapInstance){ crowdMapInstance.remove(); crowdMapInstance = null; }
  try{
    crowdMapInstance = L.map('crowdMapEl', { zoomControl: false, attributionControl: true }).setView([row.lat, row.lng], 12);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors', maxZoom: 17
    }).addTo(crowdMapInstance);
    L.circleMarker([row.lat, row.lng], {
      radius: 9, color: '#2f6ef2', fillColor: '#2f6ef2', fillOpacity: 0.9, weight: 2
    }).addTo(crowdMapInstance).bindPopup(`Reported ${ageText}`);
    setTimeout(() => crowdMapInstance && crowdMapInstance.invalidateSize(), 150);
  }catch(e){ /* panel not visible or map failed — non-critical, skip silently */ }
}


let gpsWatchId = null;
let lastGpsSend = 0;
const gpsShareToggle = document.getElementById('gpsShareToggle');
gpsShareToggle?.addEventListener('change', () => {
  const trainNo = liveInput.value.trim();
  if(gpsShareToggle.checked){
    if(!/^\d{4,5}$/.test(trainNo)){
      showToast('Track a train first, then turn this on.');
      gpsShareToggle.checked = false;
      return;
    }
    if(!navigator.geolocation){
      showToast("This browser can't share your location.");
      gpsShareToggle.checked = false;
      return;
    }
    showToast('Sharing your live location for this train. Thank you!');
    gpsWatchId = navigator.geolocation.watchPosition(
      pos => {
        const now = Date.now();
        if(now - lastGpsSend < 25000) return; // throttle to ~1 report / 25s
        lastGpsSend = now;
        reportPosition(trainNo, pos.coords.latitude, pos.coords.longitude);
      },
      err => { /* silent — permission denial etc. */ },
      { enableHighAccuracy: true, maximumAge: 15000, timeout: 20000 }
    );
  } else {
    if(gpsWatchId !== null){ navigator.geolocation.clearWatch(gpsWatchId); gpsWatchId = null; }
  }
});

function refreshLiveChips(){
  renderChips(liveFavChips, loadList('rp_fav_trains'), v => { liveInput.value = v; syncFavBtn(); }, true);
  renderChips(liveRecentChips, loadList('rp_recent_trains').filter(v => !loadList('rp_fav_trains').includes(v)),
    v => { liveInput.value = v; syncFavBtn(); }, false);
}
function syncFavBtn(){
  const isFav = loadList('rp_fav_trains').includes(liveInput.value.trim());
  liveFavBtn.classList.toggle('active', isFav);
  liveFavBtn.innerHTML = ICONS.star(isFav);
}
liveInput.addEventListener('input', syncFavBtn);
liveFavBtn.addEventListener('click', () => {
  const v = liveInput.value.trim();
  if(!/^\d{4,5}$/.test(v)) return;
  toggleFavorite('rp_fav_trains', v);
  syncFavBtn();
  refreshLiveChips();
});
refreshLiveChips();
syncFavBtn();

let autoRefreshTimer = null;
let lastKnownDelay = null;
const autoRefreshToggle = document.getElementById('autoRefreshToggle');

async function runLiveStatus(trainNo, silent){
  if(!/^\d{4,5}$/.test(trainNo)){
    if(!silent) setStatus(liveResult, 'Enter a valid 4-5 digit train number.', true);
    return;
  }
  if(!silent) showSkeleton(liveResult);
  const key = 'rp_live_' + trainNo + '_' + new Date().toISOString().slice(0,10);
  try{
    const result = await cachedFetch(key, `/api/live-status?trainNo=${trainNo}`);
    pushRecent('rp_recent_trains', trainNo);
    pushHistory('live', trainNo, `Train #${trainNo}`);
    refreshLiveChips();
    renderLive(result.data, result);
    checkDelayChange(result.data, silent);
  }catch(err){
    if(!silent) setStatus(liveResult, 'Could not fetch live status: ' + err.message, true);
  }
}

function checkDelayChange(data, silent){
  const delayMin = pick(data, ['delay','current_delay','data.delay'], null);
  if(delayMin === null) return;
  const dNum = parseInt(delayMin, 10);
  if(isNaN(dNum)) return;
  if(lastKnownDelay !== null && dNum !== lastKnownDelay && silent){
    const dir = dNum > lastKnownDelay ? 'increased' : 'improved';
    showToast(`Delay ${dir}: now ~${dNum} min ${dNum <= 0 ? '(on time)' : 'late'}`);
    beep();
  }
  lastKnownDelay = dNum;
}

document.getElementById('liveSubmit').addEventListener('click', () => runLiveStatus(liveInput.value.trim()));
liveInput.addEventListener('keydown', e => { if(e.key === 'Enter') runLiveStatus(liveInput.value.trim()); });

autoRefreshToggle.addEventListener('change', () => {
  if(autoRefreshTimer){ clearInterval(autoRefreshTimer); autoRefreshTimer = null; }
  if(autoRefreshToggle.checked){
    const trainNo = liveInput.value.trim();
    if(!/^\d{4,5}$/.test(trainNo)){
      showToast('Track a train first, then turn on auto-refresh.');
      autoRefreshToggle.checked = false;
      return;
    }
    showToast('Auto-refresh on — checking every 3 min while this tab is open.');
    autoRefreshTimer = setInterval(() => {
      if(document.hidden) return;
      // Bypass session cache for a genuine recheck; clear that day's cached key first.
      const key = 'rp_live_' + trainNo + '_' + new Date().toISOString().slice(0,10);
      sessionStorage.removeItem(key);
      runLiveStatus(trainNo, true);
    }, 3 * 60 * 1000);
  }
});

let liveCountdownTimer = null;

function renderLive(data, meta){
  meta = meta || {};
  if(liveCountdownTimer){ clearInterval(liveCountdownTimer); liveCountdownTimer = null; }

  const name = pick(data, ['train_name','data.train_name','name'], 'Unknown Train');
  const num = pick(data, ['train_number','data.train_number','number'], '');
  const current = pick(data, ['current_station_name','current_station','data.current_station_name','position'], null);
  const delayMin = pick(data, ['delay','current_delay','data.delay'], null);
  const status = pick(data, ['status','status_as_of','data.status'], null);
  const route = pick(data, ['route','data.route','stations'], null);
  const distFromSource = pick(data, ['distance_from_source','distanceFromSource'], null);
  const totalDist = pick(data, ['total_distance','totalDistance'], null);
  const etaMinRaw = pick(data, ['eta','minutes_to_next','eta_minutes'], null);
  const sourceStation = pick(data, ['source_station_name','from_station_name','origin'], null);
  const destStation = pick(data, ['destination_station_name','to_station_name','destination'], null);
  const destArrival = pick(data, ['expected_arrival','destination_eta','end_time'], null);
  const avgSpeed = pick(data, ['average_speed','avgSpeed'], null);

  let statusClass = 'status-line';
  let statusText;
  let isOnTime = null;
  if(delayMin !== null){
    const dNum = parseInt(delayMin, 10);
    if(!isNaN(dNum) && dNum <= 0){ statusClass += ' on-time'; statusText = 'Running on time'; isOnTime = true; }
    else if(!isNaN(dNum)){ statusClass += ' delayed'; statusText = `Running ~${dNum} min late`; isOnTime = false; }
    else statusText = String(delayMin);
  } else if(status){
    statusText = String(status);
  } else {
    statusText = 'Live status received — see details below';
  }

  let journeyHtml = '';
  if(sourceStation || destStation || distFromSource !== null){
    const covered = distFromSource !== null ? `${distFromSource} km` : '—';
    const remaining = (distFromSource !== null && totalDist !== null)
      ? `${Math.max(0, Number(totalDist) - Number(distFromSource))} km` : '—';
    const speed = avgSpeed !== null ? `${avgSpeed} km/h` : '—';
    journeyHtml = `
      <div class="journey-summary">
        <div class="journey-row">
          <div class="j-item"><div class="j-k">From</div><div class="j-v">${escapeHtml(sourceStation || '—')}</div></div>
          <div class="j-item"><div class="j-k">To</div><div class="j-v">${escapeHtml(destStation || '—')}</div></div>
        </div>
        <div class="journey-row">
          <div class="j-item"><div class="j-k">Covered so far</div><div class="j-v">${escapeHtml(covered)}</div></div>
          <div class="j-item"><div class="j-k">Remaining</div><div class="j-v">${escapeHtml(remaining)}</div></div>
        </div>
        <div class="journey-row">
          <div class="j-item"><div class="j-k">Avg speed</div><div class="j-v">${escapeHtml(speed)}</div></div>
          <div class="j-item"><div class="j-k">Expected arrival</div><div class="j-v">${escapeHtml(destArrival || '—')}</div></div>
        </div>
      </div>`;
  }

  let progressHtml = '';
  if(distFromSource !== null && totalDist !== null && Number(totalDist) > 0){
    const pct = Math.max(0, Math.min(100, (Number(distFromSource) / Number(totalDist)) * 100));
    progressHtml = `
      <div class="progress-wrap">
        <div class="progress-track">
          <div class="progress-fill" style="width:${pct}%"></div>
          <div class="progress-marker" style="left:${pct}%">${ICONS.train}</div>
        </div>
        <div class="progress-labels"><span>Source</span><span>${pct.toFixed(0)}% of journey</span><span>Destination</span></div>
      </div>`;
  }

  let stopsHtml = '';
  if(Array.isArray(route) && route.length){
    // Figure out which stop the train is currently at/near, using the API's
    // reported current-station name when we have one, otherwise falling
    // back to comparing each stop's own distance to distance covered so far.
    let currentIdx = -1;
    if(current){
      currentIdx = route.findIndex(s => {
        const n = pick(s, ['station_name','stationName','name'], '');
        return n && current && n.toLowerCase().includes(String(current).toLowerCase().split(' ')[0]);
      });
    }
    if(currentIdx === -1 && distFromSource !== null){
      route.forEach((s, i) => {
        const sd = pick(s, ['distance','distanceFromOrigin','distance_from_source'], null);
        if(sd !== null && Number(sd) <= Number(distFromSource)) currentIdx = i;
      });
    }

    stopsHtml = '<div class="route-track">' + route.map((s, i) => {
      const sName = pick(s, ['station_name','stationName','name'], 'Station');
      const arr = pick(s, ['actual_arrival_time','scharrival','arrival','arrival_time'], '--');
      const dep = pick(s, ['actual_departure_time','schdeparture','departure','departure_time'], '--');
      const d = pick(s, ['delay','delayArrival'], null);
      const sd = pick(s, ['distance','distanceFromOrigin','distance_from_source'], null);
      const dClass = (d === null || d === 0 || d === '0') ? 'ontime' : '';

      let state = 'upcoming';
      if(currentIdx !== -1){
        if(i < currentIdx) state = 'passed';
        else if(i === currentIdx) state = 'current';
      }

      return `<div class="route-stop ${state}">
        <div class="route-dot">${state === 'current' ? ICONS.train : ''}</div>
        <div class="route-info">
          <div class="route-top">
            <span class="route-name">${escapeHtml(sName)}</span>
            ${state === 'current' ? '<span class="route-live-badge">Live</span>' : ''}
          </div>
          <div class="route-meta">
            <span>${escapeHtml(arr)} → ${escapeHtml(dep)}</span>
            ${sd !== null ? `<span>· ${escapeHtml(sd)} km</span>` : ''}
            ${d !== null ? `<span class="route-delay ${dClass}">${d !== null && Number(d) > 0 ? '+' + escapeHtml(d) + ' min' : 'on time'}</span>` : ''}
          </div>
        </div>
      </div>`;
    }).join('') + '</div>';
  }

  const shareText = `${name} #${num} — ${statusText}${current ? ' (near ' + current + ')' : ''}`;
  const staleBadge = meta.offline
    ? `<div class="stale-badge">⚠ Offline${meta.savedAt ? ' — last updated ' + timeAgo(meta.savedAt) : ''}</div>`
    : '';

  liveResult.innerHTML = `
    <div class="train-card">
      ${staleBadge}
      <button class="detail-back" id="liveBackBtn">
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><path d="M15 5l-7 7 7 7" stroke-linecap="round" stroke-linejoin="round"/></svg>
      </button>
      <div class="crowd-map-wrap hero" id="crowdMapWrap">
        <div class="crowd-map-loading">Checking for live rider reports…</div>
      </div>
      <div class="train-head">
        <div>
          <div class="train-name">${escapeHtml(name)}</div>
          <div class="train-no">Train No. ${escapeHtml(num)}</div>
        </div>
        <div class="train-head-actions">
          <button class="icon-round" id="copyLiveBtn" title="Copy status">${ICONS.clipboard}</button>
          <button class="icon-round" id="shareLiveBtn" title="Share on WhatsApp">${ICONS.whatsapp}</button>
        </div>
      </div>
      ${current ? `<div style="font-size:13px;color:var(--dim);margin-top:2px;">Currently near: ${escapeHtml(current)}</div>` : ''}
      <div class="${statusClass}">${escapeHtml(statusText)}</div>
      ${journeyHtml}
      ${etaMinRaw !== null && !meta.offline ? `<div class="countdown" id="liveCountdown"></div>` : ''}
      ${progressHtml}
      ${stopsHtml}
      ${meta.fromCache && !meta.offline ? '<p class="hint">Shown from this session\'s cache — no new API call used.</p>' : ''}
      <details style="margin-top:14px;">
        <summary style="cursor:pointer;color:var(--dim);font-size:12px;">Raw response (full data)</summary>
        <pre style="white-space:pre-wrap;font-family:var(--mono);font-size:11px;color:var(--dim);margin-top:8px;max-height:260px;overflow:auto;">${escapeHtml(JSON.stringify(data, null, 2))}</pre>
      </details>
    </div>`;

  document.getElementById('liveBackBtn')?.addEventListener('click', () => {
    activateTab(lastNonLiveTab || 'between');
  });

  const copyBtn = document.getElementById('copyLiveBtn');
  copyBtn.addEventListener('click', () => {
    navigator.clipboard?.writeText(shareText).then(() => {
      copyBtn.innerHTML = iconLabel(ICONS.check, 'Copied');
      copyBtn.classList.add('copied');
      setTimeout(() => { copyBtn.innerHTML = iconLabel(ICONS.clipboard, 'Copy status'); copyBtn.classList.remove('copied'); }, 1800);
    });
  });
  document.getElementById('shareLiveBtn').addEventListener('click', () => {
    window.open(`https://wa.me/?text=${encodeURIComponent(shareText)}`, '_blank');
  });

  loadCrowdMap(num);

  if(etaMinRaw !== null && !meta.offline){
    let secondsLeft = Math.max(0, Math.round(Number(etaMinRaw) * 60));
    const el = document.getElementById('liveCountdown');
    function tick(){
      if(!el) return;
      const m = Math.floor(secondsLeft/60), s = secondsLeft%60;
      el.textContent = secondsLeft > 0
        ? `Next station in ~${m}m ${s.toString().padStart(2,'0')}s`
        : 'Arriving at next station';
      if(secondsLeft > 0) secondsLeft--;
    }
    tick();
    liveCountdownTimer = setInterval(tick, 1000);
  }
}

/* ================= PNR STATUS ================= */
const pnrResult = document.getElementById('pnrResult');
const pnrInput = document.getElementById('pnrInput');
const pnrRecentChips = document.getElementById('pnrRecentChips');
function refreshPnrChips(){
  renderChips(pnrRecentChips, loadList('rp_recent_pnr'), v => { pnrInput.value = v; }, false);
}
refreshPnrChips();

async function runPnrCheck(pnr){
  if(!/^\d{10}$/.test(pnr)){
    setStatus(pnrResult, 'Enter a valid 10-digit PNR.', true);
    return;
  }
  showSkeleton(pnrResult);
  const key = 'rp_pnr_' + pnr;
  try{
    const result = await cachedFetch(key, `/api/pnr-status?pnr=${pnr}`);
    pushRecent('rp_recent_pnr', pnr);
    pushHistory('pnr', pnr, `PNR ${pnr}`);
    refreshPnrChips();
    renderPnr(result.data, result);
  }catch(err){
    setStatus(pnrResult, 'Could not fetch PNR status: ' + err.message, true);
  }
}
document.getElementById('pnrSubmit').addEventListener('click', () => runPnrCheck(pnrInput.value.trim()));
pnrInput.addEventListener('keydown', e => { if(e.key === 'Enter') runPnrCheck(pnrInput.value.trim()); });

function renderPnr(data, meta){
  meta = meta || {};
  const trainNo = pick(data, ['trainNumber','train_number','data.trainNumber'], '--');
  const trainName = pick(data, ['trainName','train_name','data.trainName'], '--');
  const from = pick(data, ['sourceStation','from_station','boardingPoint'], '--');
  const to = pick(data, ['destinationStation','to_station'], '--');
  const dateOfJourney = pick(data, ['dateOfJourney','doj'], '--');
  const chartStatus = pick(data, ['chartStatus','chart_status'], '--');
  const passengers = pick(data, ['passengerList','passengers'], null);

  let paxHtml = '';
  if(Array.isArray(passengers) && passengers.length){
    paxHtml = passengers.map((p,i) => {
      const cur = pick(p, ['currentStatus','current_status'], '--');
      const book = pick(p, ['bookingStatus','booking_status'], '--');
      return `<div class="pnr-field"><div class="k">Passenger ${i+1}</div><div class="v">${escapeHtml(book)} → ${escapeHtml(cur)}</div></div>`;
    }).join('');
  }

  const staleBadge = meta.offline
    ? `<div class="stale-badge">⚠ Offline${meta.savedAt ? ' — last updated ' + timeAgo(meta.savedAt) : ''}</div>`
    : '';

  pnrResult.innerHTML = `
    <div class="train-card">
      ${staleBadge}
      <div class="train-head">
        <div class="train-name">${escapeHtml(trainName)}</div>
        <div class="train-no">#${escapeHtml(trainNo)}</div>
      </div>
      <div class="pnr-grid">
        <div class="pnr-field"><div class="k">From</div><div class="v">${escapeHtml(from)}</div></div>
        <div class="pnr-field"><div class="k">To</div><div class="v">${escapeHtml(to)}</div></div>
        <div class="pnr-field"><div class="k">Date</div><div class="v">${escapeHtml(dateOfJourney)}</div></div>
        <div class="pnr-field"><div class="k">Chart</div><div class="v">${escapeHtml(chartStatus)}</div></div>
        ${paxHtml}
      </div>
      ${meta.fromCache && !meta.offline ? '<p class="hint">Shown from this session\'s cache — no new API call used.</p>' : ''}
      <div class="result-actions">
        <button class="icon-btn" id="copyPnrBtn">${iconLabel(ICONS.clipboard, "Copy status")}</button>
        <button class="icon-btn" id="sharePnrBtn">${iconLabel(ICONS.whatsapp, "Share")}</button>
      </div>
      <details style="margin-top:14px;">
        <summary style="cursor:pointer;color:var(--dim);font-size:12px;">Raw response (full data)</summary>
        <pre style="white-space:pre-wrap;font-family:var(--mono);font-size:11px;color:var(--dim);margin-top:8px;max-height:260px;overflow:auto;">${escapeHtml(JSON.stringify(data, null, 2))}</pre>
      </details>
    </div>`;

  const copyBtn = document.getElementById('copyPnrBtn');
  const shareText = `${trainName} #${trainNo} | ${from} → ${to} | ${dateOfJourney} | Chart: ${chartStatus}`;
  copyBtn.addEventListener('click', () => {
    navigator.clipboard?.writeText(shareText).then(() => {
      copyBtn.innerHTML = iconLabel(ICONS.check, 'Copied');
      copyBtn.classList.add('copied');
      setTimeout(() => { copyBtn.innerHTML = iconLabel(ICONS.clipboard, 'Copy status'); copyBtn.classList.remove('copied'); }, 1800);
    });
  });
  document.getElementById('sharePnrBtn').addEventListener('click', () => {
    window.open(`https://wa.me/?text=${encodeURIComponent(shareText)}`, '_blank');
  });
}

/* ================= TRAINS BETWEEN STATIONS ================= */
let stations = [];
fetch('data/stations.json').then(r => r.json()).then(list => stations = list).catch(() => { stations = []; });

function wireAutocomplete(inputId, suggId){
  const input = document.getElementById(inputId);
  const box = document.getElementById(suggId);
  input.addEventListener('input', () => {
    const q = input.value.trim().toLowerCase();
    if(q.length < 2){ box.classList.remove('show'); box.innerHTML=''; return; }
    const matches = stations.filter(s =>
      s.name.toLowerCase().includes(q) || s.code.toLowerCase().includes(q)
    ).slice(0, 8);
    if(!matches.length){ box.classList.remove('show'); box.innerHTML=''; return; }
    box.innerHTML = matches.map(s =>
      `<div class="sugg-item" data-code="${s.code}"><span>${escapeHtml(s.name)}</span><span class="sugg-code">${escapeHtml(s.code)}</span></div>`
    ).join('');
    box.classList.add('show');
    box.querySelectorAll('.sugg-item').forEach(el => {
      el.addEventListener('click', () => {
        input.value = el.dataset.code;
        box.classList.remove('show');
      });
    });
  });
  document.addEventListener('click', e => {
    if(!box.contains(e.target) && e.target !== input) box.classList.remove('show');
  });
}
wireAutocomplete('fromStation', 'fromSuggestions');
wireAutocomplete('toStation', 'toSuggestions');

/* ---- find nearest station via geolocation ---- */
function haversineKm(lat1, lng1, lat2, lng2){
  const R = 6371;
  const dLat = (lat2-lat1) * Math.PI/180;
  const dLng = (lng2-lng1) * Math.PI/180;
  const a = Math.sin(dLat/2)**2 + Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dLng/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}
document.getElementById('nearestBtn').addEventListener('click', () => {
  const btn = document.getElementById('nearestBtn');
  if(!stations.length){
    showToast('Station list still loading — try again in a second.');
    return;
  }
  if(!navigator.geolocation){
    showToast("This browser can't share your location.");
    return;
  }
  btn.textContent = '…';
  navigator.geolocation.getCurrentPosition(
    pos => {
      const { latitude, longitude } = pos.coords;
      let nearest = null, bestDist = Infinity;
      for(const s of stations){
        if(s.lat === undefined) continue;
        const d = haversineKm(latitude, longitude, s.lat, s.lng);
        if(d < bestDist){ bestDist = d; nearest = s; }
      }
      btn.innerHTML = ICONS.pin;
      if(nearest){
        document.getElementById('fromStation').value = nearest.code;
        showToast(`Nearest: ${nearest.name} (${nearest.code}) — ~${bestDist.toFixed(0)} km away`);
      } else {
        showToast('Could not match a nearby station from the local list.');
      }
    },
    err => {
      btn.innerHTML = ICONS.pin;
      showToast('Location access denied or unavailable.');
    },
    { timeout: 8000 }
  );
});

const todayStr = new Date().toISOString().slice(0,10);
document.getElementById('journeyDate').value = todayStr;
document.getElementById('journeyDate').min = todayStr;

const betweenResult = document.getElementById('betweenResult');
const betweenRecentChips = document.getElementById('betweenRecentChips');
function refreshBetweenChips(){
  renderChips(betweenRecentChips, loadList('rp_recent_routes'), v => {
    const [f,t] = v.split('→');
    document.getElementById('fromStation').value = f;
    document.getElementById('toStation').value = t;
  }, false);
}
refreshBetweenChips();

async function runBetweenSearch(){
  const from = document.getElementById('fromStation').value.trim().toUpperCase();
  const to = document.getElementById('toStation').value.trim().toUpperCase();
  const date = document.getElementById('journeyDate').value || todayStr;
  if(!from || !to){
    setStatus(betweenResult, 'Enter both from and to station codes.', true);
    return;
  }
  showSkeleton(betweenResult);
  const key = 'rp_between_' + from + '_' + to + '_' + date;
  try{
    const result = await cachedFetch(key, `/api/trains-between?from=${from}&to=${to}&date=${date}`);
    pushRecent('rp_recent_routes', from + '→' + to);
    pushHistory('between', from + '→' + to, `${from} → ${to}`);
    refreshBetweenChips();
    renderBetween(result.data, result);
  }catch(err){
    setStatus(betweenResult, 'Could not fetch trains: ' + err.message, true);
  }
}
document.getElementById('betweenSubmit').addEventListener('click', runBetweenSearch);

let lastBetweenList = null;
let sortAsc = true;

function parseTimeToMinutes(t){
  const m = String(t).match(/(\d{1,2}):(\d{2})/);
  if(!m) return null;
  return parseInt(m[1], 10) * 60 + parseInt(m[2], 10);
}

function renderBetween(data, meta){
  meta = meta || {};
  const list = pick(data, ['trainBtwnStnsList','trains','data'], []);
  const staleBadge = meta.offline
    ? `<div class="stale-badge">⚠ Offline${meta.savedAt ? ' — last updated ' + timeAgo(meta.savedAt) : ''}</div>`
    : '';
  const pill = document.getElementById('floatingPill');
  const countEl = document.getElementById('betweenResultCount');
  const headerEl = document.getElementById('betweenResultHeader');
  const routeLabelEl = document.getElementById('betweenRouteLabel');
  const from = document.getElementById('fromStation')?.value.trim().toUpperCase() || '';
  const to = document.getElementById('toStation')?.value.trim().toUpperCase() || '';

  if(!Array.isArray(list) || !list.length){
    if(pill) pill.hidden = true;
    if(headerEl) headerEl.hidden = true;
    betweenResult.innerHTML = `${staleBadge}<div class="status-msg">No trains found for this route/date.</div>
      <details style="margin-top:10px;"><summary style="cursor:pointer;color:var(--dim);font-size:12px;">Raw response</summary>
      <pre style="white-space:pre-wrap;font-family:var(--mono);font-size:11px;color:var(--dim);margin-top:8px;">${escapeHtml(JSON.stringify(data, null, 2))}</pre></details>`;
    return;
  }

  lastBetweenList = list;
  activeTypeFilters.clear();
  if(pill) pill.hidden = false;
  if(headerEl) headerEl.hidden = false;
  if(routeLabelEl) routeLabelEl.textContent = from && to ? `${from} → ${to}` : 'Search Results';
  if(countEl) countEl.textContent = `${list.length} train${list.length === 1 ? '' : 's'} found`;

  const journeyDateVal = document.getElementById('journeyDate')?.value || todayStr;
  const journeyDateObj = new Date(journeyDateVal + 'T00:00:00');
  const journeyDateLabel = journeyDateObj.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', weekday: 'short' });

  renderBetweenList(list, staleBadge, meta, journeyDateObj, journeyDateLabel);
}

function renderBetweenList(list, staleBadge, meta, journeyDateObj, journeyDateLabel){
  const sorted = [...list].sort((a, b) => {
    const da = parseTimeToMinutes(pick(a, ['from_std','departureTime'], '')) ?? 9999;
    const db = parseTimeToMinutes(pick(b, ['from_std','departureTime'], '')) ?? 9999;
    return sortAsc ? da - db : db - da;
  });

  const items = sorted.map((t, i) => {
    const name = pick(t, ['train_name','trainName'], 'Train');
    const no = pick(t, ['train_number','trainNumber'], '--');
    const dep = pick(t, ['from_std','departureTime'], '--');
    const arr = pick(t, ['to_std','arrivalTime'], '--');
    const dur = pick(t, ['duration','travelTime'], '');
    const runsOn = pick(t, ['run_days','runDays','runningDays'], null);

    // Best-effort arrival date: if arrival clock-time is earlier than
    // departure clock-time, the train likely arrives the next day.
    const depMin = parseTimeToMinutes(dep);
    const arrMin = parseTimeToMinutes(arr);
    let arrDateLabel = journeyDateLabel;
    if(depMin !== null && arrMin !== null && arrMin < depMin){
      const nextDay = new Date(journeyDateObj);
      nextDay.setDate(nextDay.getDate() + 1);
      arrDateLabel = nextDay.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', weekday: 'short' });
    }

    return `<button class="train-list-item" data-no="${escapeHtml(no)}" data-i="${i}">
      <div class="tli-top">
        <div>
          <div class="tli-name">${escapeHtml(name)}</div>
          <div class="tli-no">Train No. ${escapeHtml(no)}</div>
        </div>
        ${dur ? `<div class="tli-dur">${escapeHtml(dur)}</div>` : ''}
      </div>
      <div class="tli-ticket">
        <div class="tli-dates"><span>${escapeHtml(journeyDateLabel)}</span><span>${escapeHtml(arrDateLabel)}</span></div>
        ${runsOn ? `<div class="tli-runs">${escapeHtml(runsOn)}</div>` : ''}
        <div class="tli-route">
          <span class="tli-time">${escapeHtml(dep)}</span>
          <span class="tli-line"><span class="tli-dot"></span><span class="tli-bar"></span><span class="tli-dot end"></span></span>
          <span class="tli-time">${escapeHtml(arr)}</span>
        </div>
      </div>
      <div class="tli-cta">${iconLabel(ICONS.train, 'View live status & full route')}</div>
    </button>`;
  }).join('');

  betweenResult.innerHTML = staleBadge + items + (meta.fromCache && !meta.offline ? '<p class="hint">Shown from this session\'s cache — no new API call used.</p>' : '');

  betweenResult.querySelectorAll('.train-list-item').forEach(card => {
    card.addEventListener('click', () => {
      const trainNo = card.dataset.no;
      if(!/^\d{4,5}$/.test(trainNo)){
        showToast("This train's number isn't available for live tracking.");
        return;
      }
      activateTab('live');
      liveInput.value = trainNo;
      syncFavBtn();
      showToast('Opening live status — uses 1 API call.');
      runLiveStatus(trainNo);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  });
}

/* ---------------- train-type filter (detected from train name, not fake) ---------------- */
const TRAIN_TYPES = ['Rajdhani','Shatabdi','Duronto','Garib Rath','Jan Shatabdi','Humsafar','Tejas','Vande Bharat','Superfast','Express','Passenger','Intercity'];
function detectType(name){
  const n = String(name).toLowerCase();
  for(const t of TRAIN_TYPES){ if(n.includes(t.toLowerCase())) return t; }
  return null;
}
const activeTypeFilters = new Set();
function applyTypeFilter(list){
  if(!activeTypeFilters.size) return list;
  return list.filter(t => {
    const name = pick(t, ['train_name','trainName'], '');
    const type = detectType(name);
    return type && activeTypeFilters.has(type);
  });
}
function refreshBetweenView(){
  if(!lastBetweenList) return;
  const journeyDateVal = document.getElementById('journeyDate')?.value || todayStr;
  const journeyDateObj = new Date(journeyDateVal + 'T00:00:00');
  const journeyDateLabel = journeyDateObj.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', weekday: 'short' });
  const visible = applyTypeFilter(lastBetweenList);
  const countEl = document.getElementById('betweenResultCount');
  if(countEl) countEl.textContent = `${visible.length} train${visible.length === 1 ? '' : 's'} found${activeTypeFilters.size ? ' · filtered' : ''}`;
  renderBetweenList(visible, '', { fromCache: true, offline: false }, journeyDateObj, journeyDateLabel);
}

document.getElementById('betweenBackBtn')?.addEventListener('click', () => {
  document.getElementById('panel-between')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
});

document.getElementById('pillSort')?.addEventListener('click', function(){
  sortAsc = !sortAsc;
  this.querySelector('svg')?.style.setProperty('transform', sortAsc ? 'scaleY(1)' : 'scaleY(-1)');
  refreshBetweenView();
});

const filterSheet = document.getElementById('filterSheet');
document.getElementById('pillFilter')?.addEventListener('click', () => {
  if(!lastBetweenList || !filterSheet) return;
  const typesPresent = [...new Set(lastBetweenList.map(t => detectType(pick(t, ['train_name','trainName'], ''))).filter(Boolean))];
  const optionsEl = document.getElementById('filterOptions');
  if(!typesPresent.length){
    optionsEl.innerHTML = '<div class="hint">No recognizable train types in this result set.</div>';
  } else {
    optionsEl.innerHTML = typesPresent.map(t =>
      `<button class="filter-chip${activeTypeFilters.has(t) ? ' selected' : ''}" data-type="${escapeHtml(t)}">${escapeHtml(t)}</button>`
    ).join('');
    optionsEl.querySelectorAll('.filter-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        const t = chip.dataset.type;
        if(activeTypeFilters.has(t)) activeTypeFilters.delete(t); else activeTypeFilters.add(t);
        chip.classList.toggle('selected');
      });
    });
  }
  filterSheet.hidden = false;
});
document.getElementById('filterSheetClose')?.addEventListener('click', () => { if(filterSheet) filterSheet.hidden = true; });
document.getElementById('filterApply')?.addEventListener('click', () => {
  if(filterSheet) filterSheet.hidden = true;
  refreshBetweenView();
});

renderHistory();

})();
