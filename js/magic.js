
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
let lastSpellId = null;
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
    id: 'elder-god',
    weight: 5,
    minCastCount: 4, // Can't appear before the 4th cast
    run(button) {
      button.textContent = 'You’re calling an ELDER GOD (refresh browser to cancel) !';
      setTimeout(() => {
        window.location.href = "https://www.youtube.com/watch?v=dQw4w9WgXcQ";
      }, 4000);
    }
  }
];

// Picks a spell at random, weighted by SPELLS[].weight, restricted to spells
// eligible at the current cast count and excluding one spell id (anti-repeat)
// — a single weighted pass, no rerolling/looping involved.
function pickSpell(currentCastCount, excludeId) {
    const eligible = SPELLS.filter(s => currentCastCount >= s.minCastCount && s.id !== excludeId);
    const total = eligible.reduce((sum, s) => sum + s.weight, 0);
    let roll = Math.random() * total;
    for (const spell of eligible) {
      if (roll < spell.weight) return spell;
      roll -= spell.weight;
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

    const spell = castCount === 1
      ? SPELLS.find(s => s.id === FORCED_FIRST_CAST_SPELL_ID)
      : pickSpell(castCount, lastSpellId);

    lastSpellId = spell.id;
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
