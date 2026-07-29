
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
let isFirstCast = true;
let lastSpellBucket = -1;

// Bucket weights (must sum to 100): 0=nothing, 1=Alakazam, 2=Bardic/Mockery,
// 3=Thunderwave, 4=Emoji Meteor Shower, 5=Elder God.
const SPELL_WEIGHTS = [8, 20, 27, 20, 20, 5];
// Inclusive [low, high] range of randomNum values represented by each bucket.
const BUCKET_RANGES = [[0, 1], [2, 3], [4, 5], [6, 7], [8, 9], [10, 10]];

function getSpellBucket(num) {
    if (num <= 1) return 0;
    if (num <= 3) return 1;
    if (num <= 5) return 2;
    if (num <= 7) return 3;
    if (num <= 9) return 4;
    return 5;
}

// Picks a bucket at random according to SPELL_WEIGHTS, optionally excluding one
// bucket (used for anti-repeat) without ever looping.
function pickWeightedBucket(excludeBucket) {
    const total = SPELL_WEIGHTS.reduce((sum, weight, i) => i === excludeBucket ? sum : sum + weight, 0);
    let roll = Math.random() * total;
    for (let i = 0; i < SPELL_WEIGHTS.length; i++) {
      if (i === excludeBucket) continue;
      if (roll < SPELL_WEIGHTS[i]) return i;
      roll -= SPELL_WEIGHTS[i];
    }
    // Fallback for floating point edge cases: last non-excluded bucket.
    for (let i = SPELL_WEIGHTS.length - 1; i >= 0; i--) {
      if (i !== excludeBucket) return i;
    }
    return 0;
}

function randomNumForBucket(bucket) {
    const [low, high] = BUCKET_RANGES[bucket];
    return low + Math.floor(Math.random() * (high - low + 1));
}

function magicFunction() {
    const button = document.getElementById('spell-toggle');

    if (button.textContent != '--> Cast a Spell !') {
      return;
    }

    let randomNum;

    if (isFirstCast) {
      // First cast is always Thunderwave
      randomNum = 6;
      isFirstCast = false;
    } else {
      const bucket = pickWeightedBucket(lastSpellBucket);
      randomNum = randomNumForBucket(bucket);
    }

    lastSpellBucket = getSpellBucket(randomNum);

    if (randomNum >= 0 && randomNum <= 1) 
    {
      button.textContent = 'You cast... nothing?! Oh well, better luck next time!';
    } 
    else if (randomNum >= 2 && randomNum <= 3) 
    {
      button.textContent = 'Alakazam !';
      toggleTheme();
    } 
    else if (randomNum >= 4 && randomNum <= 5) 
    {
      const messages = [
        "You gained Bardic Inspiration: You're not a bug, you're a feature!",
        "You gained Bardic Inspiration: Code like no one's watching!",
        "You gained Bardic Inspiration: Push to prod. Live a little.",
        "You cast Vicious Mockery: You miss 100% of the semicolons you don't type;",
        "You cast Vicious Mockery: Good code is its own best documentation."
      ];
      button.textContent = messages[Math.floor(Math.random() * messages.length)];
    } 
    else if (randomNum >= 6 && randomNum <= 7) 
    {
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
    else if (randomNum >= 8 && randomNum <= 9) 
    {
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
    else if (randomNum === 10) 
    {
        button.textContent = 'You’re calling an ELDER GOD (refresh browser to cancel) !';
        setTimeout(() => {
          window.location.href = "https://www.youtube.com/watch?v=dQw4w9WgXcQ";
        }, 4000);
    }

    if (revertTimeout) {
      clearTimeout(revertTimeout);
    }
    if (hideTimeout) {
      clearTimeout(hideTimeout);
    }

    revertTimeout = setTimeout(() => {
      button.textContent = '--> Cast a Spell !';
    }, 6000);

    hideTimeout = setTimeout(() => {
       typewritersection.style.display = 'none';
    }, 60000); // 60 seconds
}
