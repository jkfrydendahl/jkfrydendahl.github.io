
function toggleTheme() {
  const html = document.documentElement;
  const current = html.getAttribute('data-theme');
      if (current === 'light') {
        html.removeAttribute('data-theme');
      } else {
        html.setAttribute('data-theme', 'light');
      }
}

let typewriterInstance = null;
let typewriterTimeout = null;

function magicFunction() {
    const typewritersection = document.getElementById('typewriter');
    const button = document.getElementById('spell-toggle');
    const randomNum = Math.floor(Math.random() * 11);

    if (randomNum >= 0 && randomNum <= 1) 
    {
      button.textContent = 'It’s alive !';
      typewritersection.style.display = 'block';
        if (!typewriterInstance) {
          typewriterInstance = new Typewriter('#typewriter', {
            strings: [
              'Clean Code + DevEx = 42',
              'If your first attempt fails, call it version 1.0',
              'Press CTRL to take control.',
              'SHIFT your focus.',
              'Life would be so much easier if we had the source code.',
              'Eat. Sleep. Code.',
              'Keep calm and code on.',
              'I code, therefore I am.',
              'To err is human, to debug divine.',
              'Developers: turning coffee into software since 01.01.1753',
              'There’s no place like 127.0.0.1',
            ],
            autoStart: true,
            loop: true,
          });
        }
    } 
    else if (randomNum >= 2 && randomNum <= 3) 
    {
      button.textContent = 'Alakazam !';
      toggleTheme();
    } 
    else if (randomNum >= 4 && randomNum <= 5) 
    {
      const messages = [
        "Bardic Inspiration: You're not a bug, you're a feature!",
        "Bardic Inspiration: Code like no one's watching!",
        "Bardic Inspiration: Push to prod. Live a little.",
        "Bardic Inspiration: You miss 100% of the semicolons you don't type ;",
        "Bardic Inspiration: Good code is its own best documentation."
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
        button.textContent = 'Casting Thunderwave !';
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
            span.style.animation = `fall ${Math.random() * 0.5 + 0.5}s linear`;
            span.style.zIndex = 9999;
            document.body.appendChild(span);

            span.addEventListener('animationend', () => span.remove());
          }
        button.textContent = 'Summoning an Emoji Meteor Shower !';
    } 
    else if (randomNum === 10) 
    {
        button.textContent = 'Calling an ELDER GOD (refresh browser to cancel) !';
        setTimeout(() => {
          window.location.href = "https://www.youtube.com/watch?v=dQw4w9WgXcQ";
        }, 3000);
    }

    if (typewriterTimeout) {
      clearTimeout(typewriterTimeout);
    }

    typewriterTimeout = setTimeout(() => {
      button.textContent = '--> Cast a spell !';
    }, 4000);

    typewriterTimeout = setTimeout(() => {
       typewritersection.style.display = 'none';
    }, 60000); // 60 seconds
}