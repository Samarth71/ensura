(function(){
"use strict";

/* ---------------- service worker: app shell works offline ---------------- */
if('serviceWorker' in navigator){
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  });
}

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
  indicator.style.left = el.offsetLeft + 'px';
  indicator.style.width = el.offsetWidth + 'px';
}
tabs.forEach(t => t.addEventListener('click', () => {
  tabs.forEach(x => x.classList.remove('active'));
  panels.forEach(x => x.classList.remove('active'));
  t.classList.add('active');
  document.getElementById('panel-' + t.dataset.tab).classList.add('active');
  positionIndicator(t);
}));
window.addEventListener('load', () => positionIndicator(document.querySelector('.tab.active')));
window.addEventListener('resize', () => positionIndicator(document.querySelector('.tab.active')));

/* ---------------- localStorage: favorites & recents ---------------- */
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

/* ================= LIVE STATUS ================= */
const liveResult = document.getElementById('liveResult');
const liveInput = document.getElementById('liveTrainNo');
const liveFavBtn = document.getElementById('liveFavBtn');
const liveFavChips = document.getElementById('liveFavChips');
const liveRecentChips = document.getElementById('liveRecentChips');

function refreshLiveChips(){
  renderChips(liveFavChips, loadList('rp_fav_trains'), v => { liveInput.value = v; syncFavBtn(); }, true);
  renderChips(liveRecentChips, loadList('rp_recent_trains').filter(v => !loadList('rp_fav_trains').includes(v)),
    v => { liveInput.value = v; syncFavBtn(); }, false);
}
function syncFavBtn(){
  const isFav = loadList('rp_fav_trains').includes(liveInput.value.trim());
  liveFavBtn.classList.toggle('active', isFav);
  liveFavBtn.textContent = isFav ? '★' : '☆';
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

  let progressHtml = '';
  if(distFromSource !== null && totalDist !== null && Number(totalDist) > 0){
    const pct = Math.max(0, Math.min(100, (Number(distFromSource) / Number(totalDist)) * 100));
    progressHtml = `
      <div class="progress-wrap">
        <div class="progress-track">
          <div class="progress-fill" style="width:${pct}%"></div>
          <div class="progress-marker" style="left:${pct}%">🚆</div>
        </div>
        <div class="progress-labels"><span>Source</span><span>${pct.toFixed(0)}% of journey</span><span>Destination</span></div>
      </div>`;
  }

  let stopsHtml = '';
  if(Array.isArray(route) && route.length){
    stopsHtml = '<div class="stops">' + route.map(s => {
      const sName = pick(s, ['station_name','stationName','name'], 'Station');
      const arr = pick(s, ['actual_arrival_time','scharrival','arrival','arrival_time'], '--');
      const dep = pick(s, ['actual_departure_time','schdeparture','departure','departure_time'], '--');
      const d = pick(s, ['delay','delayArrival'], null);
      const dClass = (d === null || d === 0 || d === '0') ? 'ontime' : '';
      return `<div class="stop-row">
        <div class="stop-name">${escapeHtml(sName)}</div>
        <div class="stop-time">${escapeHtml(arr)} → ${escapeHtml(dep)}</div>
        <div class="stop-delay ${dClass}">${d !== null ? escapeHtml(d) + ' min' : ''}</div>
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
      <div class="train-head">
        <div class="train-name">${escapeHtml(name)}</div>
        <div class="train-no">#${escapeHtml(num)}</div>
      </div>
      ${current ? `<div style="font-size:13px;color:var(--dim)">Currently near: ${escapeHtml(current)}</div>` : ''}
      <div class="${statusClass}">${escapeHtml(statusText)}</div>
      ${etaMinRaw !== null && !meta.offline ? `<div class="countdown" id="liveCountdown"></div>` : ''}
      ${progressHtml}
      ${stopsHtml}
      ${meta.fromCache && !meta.offline ? '<p class="hint">Shown from this session\'s cache — no new API call used.</p>' : ''}
      <div class="result-actions">
        <button class="icon-btn" id="copyLiveBtn">📋 Copy status</button>
      </div>
      <details style="margin-top:14px;">
        <summary style="cursor:pointer;color:var(--dim);font-size:12px;">Raw response (full data)</summary>
        <pre style="white-space:pre-wrap;font-family:var(--mono);font-size:11px;color:var(--dim);margin-top:8px;max-height:260px;overflow:auto;">${escapeHtml(JSON.stringify(data, null, 2))}</pre>
      </details>
    </div>`;

  const copyBtn = document.getElementById('copyLiveBtn');
  copyBtn.addEventListener('click', () => {
    navigator.clipboard?.writeText(shareText).then(() => {
      copyBtn.textContent = '✓ Copied';
      copyBtn.classList.add('copied');
      setTimeout(() => { copyBtn.textContent = '📋 Copy status'; copyBtn.classList.remove('copied'); }, 1800);
    });
  });

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
        <button class="icon-btn" id="copyPnrBtn">📋 Copy status</button>
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
      copyBtn.textContent = '✓ Copied';
      copyBtn.classList.add('copied');
      setTimeout(() => { copyBtn.textContent = '📋 Copy status'; copyBtn.classList.remove('copied'); }, 1800);
    });
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
    refreshBetweenChips();
    renderBetween(result.data, result);
  }catch(err){
    setStatus(betweenResult, 'Could not fetch trains: ' + err.message, true);
  }
}
document.getElementById('betweenSubmit').addEventListener('click', runBetweenSearch);

function renderBetween(data, meta){
  meta = meta || {};
  const list = pick(data, ['trainBtwnStnsList','trains','data'], []);
  const staleBadge = meta.offline
    ? `<div class="stale-badge">⚠ Offline${meta.savedAt ? ' — last updated ' + timeAgo(meta.savedAt) : ''}</div>`
    : '';
  if(!Array.isArray(list) || !list.length){
    betweenResult.innerHTML = `${staleBadge}<div class="status-msg">No trains found for this route/date.</div>
      <details style="margin-top:10px;"><summary style="cursor:pointer;color:var(--dim);font-size:12px;">Raw response</summary>
      <pre style="white-space:pre-wrap;font-family:var(--mono);font-size:11px;color:var(--dim);margin-top:8px;">${escapeHtml(JSON.stringify(data, null, 2))}</pre></details>`;
    return;
  }
  const items = list.map(t => {
    const name = pick(t, ['train_name','trainName'], 'Train');
    const no = pick(t, ['train_number','trainNumber'], '--');
    const dep = pick(t, ['from_std','departureTime'], '--');
    const arr = pick(t, ['to_std','arrivalTime'], '--');
    const dur = pick(t, ['duration','travelTime'], '');
    return `<div class="train-list-item">
      <div class="l"><div class="name">${escapeHtml(name)}</div><div class="no">#${escapeHtml(no)}</div></div>
      <div class="r">${escapeHtml(dep)} → ${escapeHtml(arr)}${dur ? '<br>'+escapeHtml(dur) : ''}</div>
    </div>`;
  }).join('');
  betweenResult.innerHTML = staleBadge + items + (meta.fromCache && !meta.offline ? '<p class="hint">Shown from this session\'s cache — no new API call used.</p>' : '');
}

})();
