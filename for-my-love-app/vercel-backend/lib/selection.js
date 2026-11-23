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

const copenhagen = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Europe/Copenhagen', year: 'numeric', month: '2-digit',
  day: '2-digit', hour: '2-digit', hourCycle: 'h23'
});

export function getCutoverSlot(date = new Date()) {
  const parts = Object.fromEntries(copenhagen.formatToParts(date)
    .filter((part) => part.type !== 'literal').map((part) => [part.type, part.value]));
  const day = new Date(`${parts.year}-${parts.month}-${parts.day}T00:00:00Z`);
  if (Number(parts.hour) < 8) day.setUTCDate(day.getUTCDate() - 1);
  return day.toISOString().slice(0, 10);
}

function weightedIndex(items, usage, random) {
  let weights = items.map((_, index) => {
    const count = usage[index] || 0;
    return count >= 3 ? 0 : 1 / (1 + count);
  });
  let total = weights.reduce((sum, weight) => sum + weight, 0);
  if (total === 0) {
    for (const index of Object.keys(usage)) delete usage[index];
    weights = items.map(() => 1);
    total = items.length;
  }
  const target = random() * total;
  let running = 0;
  const selected = weights.findIndex((weight) => (running += weight) > target);
  if (selected < 0) throw new Error('Cannot select from an empty catalog');
  usage[selected] = (usage[selected] || 0) + 1;
  return selected;
}

export function selectDisplay(previous, catalog, date = new Date(), random = Math.random) {
  const slot = getCutoverSlot(date);
  const year = slot.slice(0, 4);
  const history = previous?.catalogVersion === catalog.version
    ? structuredClone(previous.history)
    : { year, quoteUsage: {}, nicknameUsage: {}, usedIds: [] };
  if (history.year !== year) {
    history.year = year;
    history.quoteUsage = {};
    history.nicknameUsage = {};
  }
  const quoteIndex = weightedIndex(catalog.quotes, history.quoteUsage, random);
  const nicknameIndex = weightedIndex(catalog.nicknames, history.nicknameUsage, random);
  const themes = getQuoteThemes(catalog.quotes[quoteIndex]);
  let available = catalog.soundtracks.filter((track) => !history.usedIds.includes(track.id));
  if (!available.length) {
    history.usedIds = [];
    available = catalog.soundtracks;
  }
  const ranked = available.map((track) => ({ track, score: scoreSoundtrack(track, themes) }));
  const bestScore = Math.max(...ranked.map((item) => item.score));
  const finalists = ranked.filter((item) => item.score >= bestScore - 1);
  const selected = finalists[Math.floor(random() * finalists.length)]?.track || null;
  if (selected) history.usedIds.push(selected.id);
  return {
    revision: (previous?.revision || 0) + 1,
    catalogVersion: catalog.version,
    history,
    display: {
      slot,
      quote: catalog.quotes[quoteIndex],
      nickname: catalog.nicknames[nicknameIndex],
      quoteEmoji: catalog.quoteEmojis[quoteIndex] || '✨',
      nicknameEmoji: catalog.nicknameEmojis[nicknameIndex] || '💖',
      soundtrack: selected ? { id: selected.id, title: selected.title, artist: selected.artist } : null,
      updatedAt: date.toISOString()
    }
  };
}

export function publicDisplay(state) {
  return { ...state.display, revision: state.revision };
}
