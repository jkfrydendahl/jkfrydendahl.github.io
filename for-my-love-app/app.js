const APP_VERSION = "26.11.23.1";
const VERCEL_BACKEND = "https://for-my-love-app.vercel.app";
const PUBLIC_VAPID_KEY = "BOsuQtHamndZH8ZUivuNCyZhoiBzx_n7SGbf0wwm0yIxQi0tTnk1Idb4Du9qDOgFeiRKD_-ZROf8iIchAUNJy5E";
const DISPLAY_CACHE_KEY = 'sharedDailyDisplay-v1';
const CHANGE_CODE_KEY = 'displayChangeCode-v1';
const HEARTBEAT_INTERVAL_MS = 30 * 1000;
let currentDisplay = null;
let latestServerRevision = 0;
let syncInFlight = null;
let changingDisplay = false;

function readStoredJson(key, fallback = null) {
  try {
    return JSON.parse(localStorage.getItem(key)) ?? fallback;
  } catch {
    return fallback;
  }
}

function writeStoredJson(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Sync still works when this browser cannot keep a local cache.
  }
}

function forgetChangeCode() {
  try { localStorage.removeItem(CHANGE_CODE_KEY); } catch {}
}

function isIOS() {
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

function isStandalone() {
  return window.matchMedia?.("(display-mode: standalone)").matches
    || window.navigator.standalone === true;
}

function urlBase64ToUint8Array(value) {
  const padding = "=".repeat((4 - (value.length % 4)) % 4);
  const base64 = (value + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  return Uint8Array.from(raw, (character) => character.charCodeAt(0));
}

async function enablePush() {
  try {
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
      throw new Error("Push notifications are not supported");
    }
    if (!("Notification" in window)) {
      throw new Error("Notifications are not supported");
    }
    if (isIOS() && !isStandalone()) {
      throw new Error("Install to Home Screen first");
    }

    const probe = await fetch("./sw.js", { cache: "no-store" });
    if (!probe.ok) {
      throw new Error(`sw.js not reachable (${probe.status})`);
    }

    await navigator.serviceWorker.register("./sw.js", { scope: "./" });
    const registration = await navigator.serviceWorker.ready;
    await registration.update();

    const permission = await Notification.requestPermission();
    if (permission !== "granted") {
      throw new Error("Permission not granted");
    }

    const applicationServerKey = urlBase64ToUint8Array(PUBLIC_VAPID_KEY);
    if (applicationServerKey.length !== 65) {
      throw new Error("Bad VAPID public key");
    }

    const subscription = await registration.pushManager.getSubscription()
      || await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey
      });

    const response = await fetch(`${VERCEL_BACKEND}/api/subscribe`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(subscription)
    });

    if (!response.ok) {
      throw new Error(`Subscribe API failed: ${response.status}`);
    }

    alert("Push enabled 🎉");
  } catch (error) {
    console.error("Push setup failed:", error);
    alert(`Push failed: ${error?.message || error}`);
  }
}

function setSyncStatus(message) {
  document.getElementById('sync-status').textContent = message;
}

function isValidDisplay(display) {
  return Boolean(display && Number.isSafeInteger(display.revision) && display.revision > 0 &&
    /^\d{4}-\d{2}-\d{2}$/.test(display.slot) &&
    typeof display.quote === 'string' && typeof display.nickname === 'string' &&
    typeof display.quoteEmoji === 'string' && typeof display.nicknameEmoji === 'string' &&
    (display.soundtrack === null || (
      /^[A-Za-z0-9]{22}$/.test(display.soundtrack?.id) &&
      typeof display.soundtrack.title === 'string' && typeof display.soundtrack.artist === 'string'
    )));
}

function renderDisplay(display) {
  document.getElementById('quote').textContent = display.quote;
  document.getElementById('nickname').textContent = `Til ${display.nickname}`;
  document.getElementById('emoji-of-the-day').textContent =
    `${display.nicknameEmoji} ${display.quoteEmoji} 🌟`;
  const track = display.soundtrack;
  document.getElementById('soundtrack').hidden = !track;
  if (track) {
    const link = document.getElementById('soundtrack-link');
    document.getElementById('soundtrack-track-title').textContent = track.title;
    document.getElementById('soundtrack-artist').textContent = track.artist;
    link.href = `https://open.spotify.com/track/${track.id}`;
    link.setAttribute('aria-label', `Open ${track.title} by ${track.artist} on Spotify`);
  }
}

function acceptDisplay(display) {
  if (!isValidDisplay(display)) throw new Error('Invalid shared entry');
  // A slow response from an earlier request must never replace a newer entry.
  if (display.revision < latestServerRevision) return;
  latestServerRevision = display.revision;
  currentDisplay = display;
  writeStoredJson(DISPLAY_CACHE_KEY, display);
  renderDisplay(display);
}

function getCopenhagenSlot(date = new Date()) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Copenhagen', year: 'numeric', month: '2-digit',
    day: '2-digit', hour: '2-digit', hourCycle: 'h23'
  }).formatToParts(date).filter((part) => part.type !== 'literal')
    .map((part) => [part.type, part.value]));
  const day = new Date(`${parts.year}-${parts.month}-${parts.day}T00:00:00Z`);
  if (Number(parts.hour) < 8) day.setUTCDate(day.getUTCDate() - 1);
  return day.toISOString().slice(0, 10);
}

function showOfflineStatus() {
  if (!currentDisplay) {
    document.getElementById('quote').textContent = 'Your daily entry is unavailable. Please reconnect to try again.';
    document.getElementById('nickname').textContent = '';
    setSyncStatus('Waiting for a connection');
  } else {
    setSyncStatus(currentDisplay.slot === getCopenhagenSlot()
      ? 'Saved entry · waiting to sync' : `Saved entry from ${currentDisplay.slot} · waiting to sync`);
  }
}

async function fetchDisplay(options) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);
  try {
    const response = await fetch(`${VERCEL_BACKEND}/api/display`, {
      ...options, cache: 'no-store', signal: controller.signal
    });
    let data;
    try { data = await response.json(); } catch { throw new Error('Shared entry is temporarily unavailable'); }
    return { response, data };
  } finally {
    clearTimeout(timeout);
  }
}

async function syncDisplay() {
  if (syncInFlight) return syncInFlight;
  syncInFlight = (async () => {
    try {
      const { response, data } = await fetchDisplay();
      if (!response.ok) throw new Error(data.error);
      acceptDisplay(data);
      if (!changingDisplay) setSyncStatus('Synced');
      return true;
    } catch {
      if (!changingDisplay) showOfflineStatus();
      return false;
    }
  })();
  try { return await syncInFlight; } finally { syncInFlight = null; }
}

function openCodeDialog() {
  const dialog = document.getElementById('change-code-dialog');
  document.getElementById('change-code').value = '';
  document.getElementById('change-code-error').textContent = '';
  if (!dialog.open) dialog.showModal();
}

async function changeDisplay(code) {
  if (changingDisplay) return;
  changingDisplay = true;
  const button = document.getElementById('reset-display');
  const submit = document.getElementById('save-change-code');
  const dialog = document.getElementById('change-code-dialog');
  button.disabled = true;
  submit.disabled = true;
  setSyncStatus('Updating…');
  try {
    // Fetch first so the replacement is tied to the currently shared revision.
    // If connectivity fails we never generate a separate local entry.
    if (!await syncDisplay() || !currentDisplay) throw new Error('Please reconnect before changing the entry.');
    const { response, data } = await fetchDisplay({
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${code}` },
      body: JSON.stringify({ revision: currentDisplay.revision })
    });
    if (response.status === 401) {
      forgetChangeCode();
      openCodeDialog();
      document.getElementById('change-code-error').textContent = 'Incorrect code. Please try again.';
      setSyncStatus('Change code required');
      return;
    }
    if (response.status === 409) {
      acceptDisplay(data.display);
      writeStoredJson(CHANGE_CODE_KEY, code);
      dialog.close();
      setSyncStatus('Updated on another device · synced');
      return;
    }
    if (!response.ok) throw new Error(data.error || 'Could not update the entry');
    acceptDisplay(data);
    writeStoredJson(CHANGE_CODE_KEY, code);
    dialog.close();
    setSyncStatus('Synced');
  } catch (error) {
    const message = error.name === 'AbortError'
      ? 'Connection interrupted. Reconnect to check whether the entry changed.'
      : error.message || 'Could not update the entry. Please try again.';
    setSyncStatus(message);
    if (dialog.open) document.getElementById('change-code-error').textContent = message;
  } finally {
    changingDisplay = false;
    button.disabled = false;
    submit.disabled = false;
    document.getElementById('change-code').value = '';
  }
}

async function initializeApp() {
  document.getElementById('app-version').textContent = `APP VERSION ${APP_VERSION}`;
  document.getElementById('enable-push').addEventListener('click', enablePush);
  document.getElementById('reset-display').addEventListener('click', () => {
    const code = readStoredJson(CHANGE_CODE_KEY);
    if (typeof code === 'string' && code) void changeDisplay(code);
    else openCodeDialog();
  });
  document.getElementById('change-code-form').addEventListener('submit', (event) => {
    event.preventDefault();
    const code = document.getElementById('change-code').value.trim();
    if (code) void changeDisplay(code);
  });
  document.getElementById('cancel-change-code').addEventListener('click', () => {
    document.getElementById('change-code-dialog').close();
    document.getElementById('change-code').value = '';
  });
  document.getElementById('forget-change-code').addEventListener('click', () => {
    forgetChangeCode();
    setSyncStatus('Change code forgotten on this device');
  });
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js', { scope: './' })
      .catch((error) => console.error('Service worker registration failed:', error));
  }
  const cached = readStoredJson(DISPLAY_CACHE_KEY);
  if (isValidDisplay(cached)) {
    currentDisplay = cached;
    renderDisplay(cached);
    showOfflineStatus();
  }
  void syncDisplay();
  setInterval(() => {
    if (!document.hidden) void syncDisplay();
  }, HEARTBEAT_INTERVAL_MS);
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) void syncDisplay();
  }, { passive: true });
  for (const event of ['focus', 'pageshow', 'online']) {
    window.addEventListener(event, () => void syncDisplay(), { passive: true });
  }
}

document.addEventListener('DOMContentLoaded', initializeApp);
