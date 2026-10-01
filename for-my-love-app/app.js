const APP_VERSION = "26.10.1.1";
const VERCEL_BACKEND = "https://for-my-love-app.vercel.app";
const PUBLIC_VAPID_KEY = "BOsuQtHamndZH8ZUivuNCyZhoiBzx_n7SGbf0wwm0yIxQi0tTnk1Idb4Du9qDOgFeiRKD_-ZROf8iIchAUNJy5E";
const CUTOVER_HOUR = 8;
const CUTOVER_MINUTE = 0;
const DAILY_STATE_KEY = `dailyDisplayState-${CUTOVER_HOUR}-${CUTOVER_MINUTE}-v1`;
const SOUNDTRACK_CYCLE_KEY = "soundtrackCycle-v1";
const HEARTBEAT_INTERVAL_MS = 30 * 1000;

const {
  quotes = [],
  nicknames = [],
  nicknameEmojis = [],
  quoteEmojis = []
} = window.APP_CONTENT || {};

const soundtrackPool = Array.isArray(window.SOUNDTRACKS)
  ? window.SOUNDTRACKS
  : [];
const soundtrackById = new Map(
  soundtrackPool.map((track) => [track.id, track])
);

const QUOTE_THEME_RULES = [
  { themes: ["love", "connection", "devotion", "trust"], pattern: /\blove|loved|loving|heart|tender|affection|romance|kiss|soul|beloved/i },
  { themes: ["joy", "celebration", "gratitude"], pattern: /happ|joy|beautiful|rainbow|sunshine|smile|good in every day|chocolate|wonderful|appreciat/i },
  { themes: ["hope", "renewal", "dreams"], pattern: /hope|faith|believe|tomorrow|light|opportunit|possible|dream/i },
  { themes: ["courage", "strength", "confidence"], pattern: /courage|brave|fear|risk|strong|strength|power|impossible|cannot|venture|fire|fearless|dare/i },
  { themes: ["resilience", "perseverance", "comfort"], pattern: /resilien|persever|persist|fail|quit|continue|stumble|fall|difficulty|challeng|hell|crack|excuse|mourning/i },
  { themes: ["selfWorth", "confidence", "individuality", "acceptance"], pattern: /yourself|your own|be your|different|not less|fully seen|within us|person you|own before|someone else.s life|time is limited|neurodivergent|adhd|normal|quirk|mold|version of me|being accepted|inconsistency|range/i },
  { themes: ["growth", "change", "journey"], pattern: /change|become|learn|education|journey|path|trail|discover|curious|expand|limits|ahead of|moving forward|start where|\bgrow|first step|beginning|direction|compass|wander/i },
  { themes: ["togetherness", "kindness", "friendship", "belonging"], pattern: /together|each other|friendship|belong|gift|offer|compassion|forgiv|attention to others|give to others|humanity/i },
  { themes: ["presence", "gratitude", "patience"], pattern: /moment|today|now|attention|presence|let go|choice|silently drawn|this is your life|slowly|wait|time is limited|precious privilege|alive/i },
  { themes: ["creativity", "imagination", "music", "expression"], pattern: /\bpoet|\bcanvas|imagination|\bart\b|artist|creat|music|song|symphony|\bmind|\bbrain|thought|thinker|discover|magic|pattern|possibilit|galax|\bstars?\b|wild|breakthrough|nonlinear/i },
  { themes: ["wonder", "nature", "joy"], pattern: /\bsky|cloud|rainbow|sun\b|universe|nature|light|world|earth|forest|wilderness|soil|\btrees?\b|season|sunset|flowers?|\bair\b|fruit/i },
  { themes: ["dreams", "confidence", "perseverance"], pattern: /dream|goal|success|winning|work|shots|destined|wanted|days count/i },
  { themes: ["freedom", "courage", "journey"], pattern: /free|freedom|barrier|choice|no path|leave a trail/i },
  { themes: ["appreciation", "gratitude", "kindness"], pattern: /appreciation|precious|thank|giving|excellent/i },
  { themes: ["respect", "selfWorth", "acceptance"], pattern: /respect|judge|judges|seen|own/i }
];

function readStoredJson(key, fallback) {
  const raw = localStorage.getItem(key);
  if (raw === null) return fallback;

  try {
    const parsed = JSON.parse(raw);
    return parsed ?? fallback;
  } catch {
    localStorage.removeItem(key);
    return fallback;
  }
}

function writeStoredJson(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch (error) {
    console.error(`Could not save local state for ${key}:`, error);
    return false;
  }
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

function getQuoteThemes(quote) {
  if (/love yourself|yourself.*deserve.*love|deserve your love/i.test(quote)) {
    return ["selfWorth", "confidence", "acceptance", "gratitude", "love"];
  }

  const themes = [];
  for (const rule of QUOTE_THEME_RULES) {
    if (rule.pattern.test(quote)) themes.push(...rule.themes);
  }

  return themes.length
    ? [...new Set(themes)]
    : ["hope", "joy", "presence"];
}

function scoreSoundtrack(track, quoteThemes) {
  return track.themes.reduce((score, theme, index) => {
    if (!quoteThemes.includes(theme)) return score;
    return score + (index === 0 ? 5 : 3);
  }, 0);
}

function getSoundtrackForQuote(quoteIndex) {
  if (!soundtrackPool.length) return null;

  let cycle = readStoredJson(SOUNDTRACK_CYCLE_KEY, { usedIds: [] });
  if (!cycle || !Array.isArray(cycle.usedIds)) {
    cycle = { usedIds: [] };
  }

  cycle.usedIds = [...new Set(
    cycle.usedIds.filter((id) => soundtrackById.has(id))
  )];

  const quoteThemes = getQuoteThemes(quotes[quoteIndex] || "");
  const rank = (tracks) => tracks.map((track) => ({
    track,
    score: scoreSoundtrack(track, quoteThemes)
  }));

  let available = soundtrackPool.filter(
    (track) => !cycle.usedIds.includes(track.id)
  );

  if (!available.length) {
    cycle = { usedIds: [] };
    available = soundtrackPool;
  }

  const ranked = rank(available);
  const bestScore = Math.max(...ranked.map((item) => item.score));
  const finalists = ranked.filter((item) => item.score >= bestScore - 1);
  const selected = finalists[Math.floor(Math.random() * finalists.length)].track;

  cycle.usedIds.push(selected.id);
  writeStoredJson(SOUNDTRACK_CYCLE_KEY, cycle);
  return selected.id;
}

function renderSoundtrack(soundtrackId) {
  const section = document.getElementById("soundtrack");
  const track = soundtrackById.get(soundtrackId);

  if (!section || !track) {
    if (section) section.hidden = true;
    return;
  }

  const link = document.getElementById("soundtrack-link");
  document.getElementById("soundtrack-track-title").textContent = track.title;
  document.getElementById("soundtrack-artist").textContent = track.artist;
  link.href = `https://open.spotify.com/track/${track.id}`;
  link.setAttribute(
    "aria-label",
    `Open ${track.title} by ${track.artist} on Spotify`
  );
  section.hidden = false;
}

function getWeightedIndex(array, keyPrefix, maxUses = 3) {
  if (!Array.isArray(array) || array.length === 0) {
    throw new Error(`${keyPrefix} cannot select from an empty collection`);
  }

  const usageKey = `${keyPrefix}-${new Date().getFullYear()}`;
  let usageMap = readStoredJson(usageKey, {});
  if (!usageMap || typeof usageMap !== "object" || Array.isArray(usageMap)) {
    usageMap = {};
  }

  let weights = array.map((_, index) => {
    const count = Number(usageMap[index]) || 0;
    return count >= maxUses ? 0 : 1 / (1 + count);
  });

  let total = weights.reduce((sum, weight) => sum + weight, 0);
  if (total === 0) {
    usageMap = {};
    weights = array.map(() => 1);
    total = array.length;
  }

  const target = Math.random() * total;
  let running = 0;
  let selectedIndex = array.length - 1;

  for (let index = 0; index < weights.length; index += 1) {
    running += weights[index];
    if (target < running) {
      selectedIndex = index;
      break;
    }
  }

  usageMap[selectedIndex] = (Number(usageMap[selectedIndex]) || 0) + 1;
  writeStoredJson(usageKey, usageMap);
  return selectedIndex;
}

function renderDisplay(nicknameIndex, quoteIndex, soundtrackId) {
  const nickname = nicknames[nicknameIndex];
  const quote = quotes[quoteIndex];
  const nicknameEmoji = nicknameEmojis[nicknameIndex] || "💖";
  const quoteEmoji = quoteEmojis[quoteIndex] || "✨";

  document.getElementById("quote").textContent = quote;
  document.getElementById("nickname").textContent = `Til ${nickname}`;
  document.getElementById("emoji-of-the-day").textContent =
    `${nicknameEmoji} ${quoteEmoji} 🌟`;
  renderSoundtrack(soundtrackId);
}

function ymdLocal(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getCutoverSlot(date = new Date()) {
  const now = new Date(date);
  const cutover = new Date(now);
  cutover.setHours(CUTOVER_HOUR, CUTOVER_MINUTE, 0, 0);

  const slotDate = now < cutover
    ? new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1)
    : new Date(now.getFullYear(), now.getMonth(), now.getDate());

  return ymdLocal(slotDate);
}

function msUntilNextCutover(date = new Date()) {
  const next = new Date(date);
  next.setHours(CUTOVER_HOUR, CUTOVER_MINUTE, 0, 0);
  if (next <= date) next.setDate(next.getDate() + 1);
  return next - date;
}

function isValidDailyState(state, slot) {
  return Boolean(
    state
    && state.slot === slot
    && Number.isInteger(state.quoteIndex)
    && state.quoteIndex >= 0
    && state.quoteIndex < quotes.length
    && Number.isInteger(state.nicknameIndex)
    && state.nicknameIndex >= 0
    && state.nicknameIndex < nicknames.length
  );
}

function ensureDailyDisplay(forceNew = false) {
  const slot = getCutoverSlot();
  let saved = readStoredJson(DAILY_STATE_KEY, null);

  if (!isValidDailyState(saved, slot)) {
    if (saved !== null) localStorage.removeItem(DAILY_STATE_KEY);
    saved = null;
  }

  if (!saved || forceNew) {
    const quoteIndex = getWeightedIndex(quotes, "quoteUsage");
    const nicknameIndex = getWeightedIndex(nicknames, "nicknameUsage");
    const soundtrackId = getSoundtrackForQuote(quoteIndex);

    saved = {
      slot,
      quoteIndex,
      nicknameIndex,
      soundtrackId,
      ts: Date.now()
    };

    writeStoredJson(DAILY_STATE_KEY, saved);
  } else if (!soundtrackById.has(saved.soundtrackId)) {
    saved.soundtrackId = getSoundtrackForQuote(saved.quoteIndex);
    writeStoredJson(DAILY_STATE_KEY, saved);
  }

  renderDisplay(saved.nicknameIndex, saved.quoteIndex, saved.soundtrackId);

  clearTimeout(window.__cutoverTimer);
  window.__cutoverTimer = setTimeout(
    () => ensureDailyDisplay(true),
    msUntilNextCutover() + 1000
  );
}

function startHeartbeat() {
  clearInterval(window.__dailyHeartbeat);
  window.__dailyHeartbeat = setInterval(() => {
    const slot = getCutoverSlot();
    const saved = readStoredJson(DAILY_STATE_KEY, null);
    if (!isValidDailyState(saved, slot)) {
      ensureDailyDisplay();
    }
  }, HEARTBEAT_INTERVAL_MS);
}

async function initializeApp() {
  document.getElementById("app-version").textContent =
    `APP VERSION ${APP_VERSION}`;
  document.getElementById("enable-push").addEventListener("click", enablePush);
  document.getElementById("reset-display").addEventListener(
    "click",
    () => ensureDailyDisplay(true)
  );

  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("./sw.js", { scope: "./" })
      .catch((error) => console.error("Service worker registration failed:", error));
  }

  ensureDailyDisplay();
  startHeartbeat();

  document.addEventListener(
    "visibilitychange",
    () => {
      if (!document.hidden) ensureDailyDisplay();
    },
    { passive: true }
  );
  window.addEventListener("focus", () => ensureDailyDisplay(), { passive: true });
  window.addEventListener("pageshow", () => ensureDailyDisplay(), { passive: true });
}

document.addEventListener("DOMContentLoaded", initializeApp);
