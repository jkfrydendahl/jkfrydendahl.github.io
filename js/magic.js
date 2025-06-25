
function toggleTheme() {
  const html = document.documentElement;
  const current = html.getAttribute('data-theme');
      if (current === 'light') {
        html.removeAttribute('data-theme');
      } else {
        html.setAttribute('data-theme', 'light');
      }
}

let magicTimeout = null;

function magicFunction() {
    const button = document.getElementById('spell-toggle');
    const randomNum = Math.floor(Math.random() * 11);

    if (button.textContent != '--> Cast a Spell !') {
      return;
    }

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
        "You gained Bardic Inspiration: You miss 100% of the semicolons you don't type ;",
        "You gained Bardic Inspiration: Good code is its own best documentation."
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
            document.body.style.left = '0px';
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

    if (magicTimeout) {
      clearTimeout(magicTimeout);
    }

    magicTimeout = setTimeout(() => {
      button.textContent = '--> Cast a Spell !';
    }, 6000);

    magicTimeout = setTimeout(() => {
       typewritersection.style.display = 'none';
    }, 60000); // 60 seconds
}
