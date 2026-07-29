
function toggleTheme() {
  const html = document.documentElement;
  const current = html.getAttribute('data-theme');
      if (current === 'light') {
        html.removeAttribute('data-theme');
      } else {
        html.setAttribute('data-theme', 'light');
      }
}

let revertTimeout = null;
let hideTimeout = null;
let isCasting = false;
let recentSpellIds = []; // Most recent cast first; hard-excluded from the next pick
let castCount = 0;

const FORCED_FIRST_CAST_SPELL_ID = 'thunderwave';

// Single source of truth for every spell: its odds, when it's allowed to
// appear, and what it actually does. Add/remove/reweight a spell by editing
// one entry here — nothing else needs to change in sync.
const SPELLS = [
  {
    id: 'nothing',
    weight: 8,
    minCastCount: 1,
    run(button) {
      button.textContent = 'You cast... nothing?! Oh well, better luck next time!';
    }
  },
  {
    id: 'alakazam',
    weight: 20,
    minCastCount: 1,
    run(button) {
      button.textContent = 'Alakazam !';
      toggleTheme();
    }
  },
  {
    id: 'bardic-mockery',
    weight: 27,
    minCastCount: 1,
    run(button) {
      const messages = [
        "You gained Bardic Inspiration: You're not a bug, you're a feature!",
        "You gained Bardic Inspiration: Code like no one's watching!",
        "You gained Bardic Inspiration: Push to prod. Live a little.",
        "You cast Vicious Mockery: You miss 100% of the semicolons you don't type;",
        "You cast Vicious Mockery: Good code is its own best documentation."
      ];
      button.textContent = messages[Math.floor(Math.random() * messages.length)];
    }
  },
  {
    id: 'thunderwave',
    weight: 20,
    minCastCount: 1,
    run(button) {
      document.body.style.position = 'relative';
      let count = 0;
      const interval = setInterval(() => {
        document.body.style.left = (count % 2 === 0 ? '5px' : '-5px');
        count++;
        if (count > 10) {
          clearInterval(interval);
          document.body.style.left = '';
          document.body.style.position = '';
        }
      }, 50);
      button.textContent = 'You cast Thunderwave !';
    }
  },
  {
    id: 'emoji-meteor',
    weight: 20,
    minCastCount: 1,
    run(button) {
      const emojis = ['💻', '🔥', '✨', '🎲', '👾', '🧠', '🍕', '📚', '🎧'];
      for (let i = 0; i < 20; i++) {
        const span = document.createElement('span');
        span.textContent = emojis[Math.floor(Math.random() * emojis.length)];
        span.style.position = 'fixed';
        span.style.left = `${Math.random() * 100}%`;
        span.style.top = '-50px';
        span.style.fontSize = `${Math.random() * 32 + 32}px`;
        span.style.animation = `fall ${Math.random() * 1 + 1}s linear`;
        span.style.zIndex = 9999;
        document.body.appendChild(span);

        span.addEventListener('animationend', () => span.remove());
      }
      button.textContent = 'You summoned an Emoji Meteor Shower !';
    }
  },
  {
    id: 'prestidigitation',
    weight: 15,
    minCastCount: 1,
    run(button) {
      button.textContent = 'You cast Prestidigitation !';
      const root = document.documentElement;
      const hues = [330, 45, 130, 200, 280];
      let i = 0;
      const interval = setInterval(() => {
        root.style.setProperty('--accent', `hsl(${hues[i % hues.length]}, 90%, 55%)`);
        i++;
      }, 200);
      setTimeout(() => {
        clearInterval(interval);
        root.style.removeProperty('--accent'); // Falls back to the theme's normal accent
      }, 2000);
    }
  },
  {
    id: 'mage-hand',
    weight: 15,
    minCastCount: 1,
    run(button) {
      button.textContent = 'You cast Mage Hand !';
      const hand = document.createElement('span');
      hand.textContent = '🖐️';
      Object.assign(hand.style, {
        position: 'fixed',
        top: `${Math.random() * 60 + 15}%`,
        left: '-60px',
        fontSize: '2.5rem',
        zIndex: '9999',
        pointerEvents: 'none',
        transition: 'transform 3s linear, opacity 3s linear'
      });
      document.body.appendChild(hand);
      // Defer to the next frame so the transition actually animates from the start position.
      requestAnimationFrame(() => {
        hand.style.transform = `translateX(${window.innerWidth + 120}px) rotate(360deg)`;
        hand.style.opacity = '0.15';
      });
      setTimeout(() => hand.remove(), 3200);
    }
  },
  {
    id: 'detect-magic',
    weight: 15,
    minCastCount: 1,
    run(button) {
      button.textContent = 'You cast Detect Magic !';
      const messages = [
        'You detect a faint aura of technical debt nearby...',
        "You sense residual magic: someone forgot a semicolon here once.",
        "A hidden ward reveals itself: 'TODO: fix this later' (written 3 years ago).",
        'You detect powerful enchantments... it\'s just !important, again.',
        "You sense an old prophecy: 'It works on my machine.'"
      ];
      const toast = document.createElement('div');
      toast.textContent = messages[Math.floor(Math.random() * messages.length)];
      Object.assign(toast.style, {
        position: 'fixed',
        bottom: '2rem',
        left: '50%',
        transform: 'translateX(-50%)',
        background: 'rgba(0, 0, 0, 0.85)',
        color: '#39ff14',
        padding: '0.75rem 1.25rem',
        borderRadius: '6px',
        fontSize: '1rem',
        maxWidth: '90vw',
        textAlign: 'center',
        zIndex: '9999',
        pointerEvents: 'none'
      });
      document.body.appendChild(toast);
      setTimeout(() => toast.remove(), 4000);
    }
  },
  {
    id: 'elder-god',
    weight: 5,
    minCastCount: 4, // Can't appear before the 4th cast
    run(button) {
      button.textContent = 'You’re calling an ELDER GOD !';
      showElderGodOverlay();
    }
  }
];

// A dismissible full-screen "jumpscare" overlay: gives the visitor a clear,
// immediate way to cancel (click anywhere), but if they don't act within the
// countdown, it auto-navigates — same spirit as the old forced redirect,
// minus the "only way out is refreshing the browser" hijack.
const ELDER_GOD_REDIRECT_DELAY_MS = 4000;
const ELDER_GOD_REDIRECT_URL = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ';

function showElderGodOverlay() {
    const overlay = document.createElement('div');
    const secondsLeft = Math.ceil(ELDER_GOD_REDIRECT_DELAY_MS / 1000);
    overlay.innerHTML = `An ELDER GOD gazes back at you from beyond the veil...<br><br>(click anywhere to banish it, or it drags you under in ${secondsLeft}s)`;
    Object.assign(overlay.style, {
      position: 'fixed',
      inset: '0',
      background: 'rgba(0, 0, 0, 0.9)',
      color: '#39ff14',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      textAlign: 'center',
      fontSize: '1.75rem',
      padding: '2rem',
      boxSizing: 'border-box',
      cursor: 'pointer',
      zIndex: '10000'
    });

    const redirectTimeout = setTimeout(() => {
      window.location.href = ELDER_GOD_REDIRECT_URL;
    }, ELDER_GOD_REDIRECT_DELAY_MS);

    overlay.addEventListener('click', () => {
      clearTimeout(redirectTimeout);
      overlay.remove();
    });

    document.body.appendChild(overlay);
}

// Picks a spell at random, weighted by SPELLS[].weight, restricted to spells
// eligible at the current cast count and excluding the most recent
// RECENT_HARD_EXCLUDE_COUNT spells outright (hard anti-repeat, not just the
// immediately previous one — otherwise a spell from 2 casts ago could come
// straight back). On top of that, any spell cast within RECENCY_WINDOW_MS
// gets its weight softly suppressed (down to RECENCY_MIN_MULTIPLIER right
// after being cast, ramping back to full weight as the window elapses).
// With a ~6s button cooldown, a 45s window covers roughly the last 7-8
// casts, so the same spell reappearing right away should feel much rarer.
const RECENT_HARD_EXCLUDE_COUNT = 2;
const RECENCY_WINDOW_MS = 45000;
const RECENCY_MIN_MULTIPLIER = 0.15;
const lastCastAt = {};

function pickSpell(currentCastCount, excludeIds, now) {
    const eligible = SPELLS.filter(s => currentCastCount >= s.minCastCount && !excludeIds.includes(s.id));
    const weights = eligible.map(s => {
      const castAt = lastCastAt[s.id];
      if (castAt == null) {
        return s.weight;
      }
      const elapsed = now - castAt;
      if (elapsed >= RECENCY_WINDOW_MS) {
        return s.weight;
      }
      const progress = elapsed / RECENCY_WINDOW_MS;
      const multiplier = RECENCY_MIN_MULTIPLIER + (1 - RECENCY_MIN_MULTIPLIER) * progress;
      return s.weight * multiplier;
    });
    const total = weights.reduce((sum, w) => sum + w, 0);
    let roll = Math.random() * total;
    for (let i = 0; i < eligible.length; i++) {
      if (roll < weights[i]) return eligible[i];
      roll -= weights[i];
    }
    return eligible[eligible.length - 1]; // Fallback for floating point edge cases
}

function magicFunction() {
    const button = document.getElementById('spell-toggle');

    if (isCasting) {
      return;
    }
    isCasting = true;
    castCount++;

    const now = Date.now();
    const spell = castCount === 1
      ? SPELLS.find(s => s.id === FORCED_FIRST_CAST_SPELL_ID)
      : pickSpell(castCount, recentSpellIds, now);

    recentSpellIds.unshift(spell.id);
    recentSpellIds = recentSpellIds.slice(0, RECENT_HARD_EXCLUDE_COUNT);
    lastCastAt[spell.id] = now;
    spell.run(button);

    if (revertTimeout) {
      clearTimeout(revertTimeout);
    }
    if (hideTimeout) {
      clearTimeout(hideTimeout);
    }

    revertTimeout = setTimeout(() => {
      button.textContent = '--> Cast a Spell !';
      isCasting = false;
    }, 6000);

    hideTimeout = setTimeout(() => {
      const typewriterSection = document.getElementById('typewriter');
      if (typewriterSection) {
        typewriterSection.style.display = 'none';
      }
    }, 60000); // 60 seconds
}
