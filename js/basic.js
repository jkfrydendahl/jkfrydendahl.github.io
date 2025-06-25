function navFunction() {
  var x = document.getElementById("main-nav");
  if (x.style.display === "block") {
    x.style.display = "none";
  } else {
    x.style.display = "block";
    x.style.position = "fixed";
    x.style.textAlign = "center";
    x.style.width ="100%";
    x.style.backgroundColor = "rgba(255,255,255,0.95)";
    x.style.paddingTop = "50px";
    x.style.paddingBottom = "50px";
    x.style.top = "0";
    x.style.zIndex ="5";
  }
}

function screenMatch() {
  var widerScreenWidth = window.matchMedia("(min-width: 1159px)");
  if (widerScreenWidth.matches) {
    function changeCss () {
      var bodyElement = document.querySelector("body");
      var navElement = document.querySelector("nav");
      var listElement = document.querySelector("#main-nav");
      this.scrollY > 100 ? navElement.style.position = "fixed" : navElement.style.position = "fixed";
      this.scrollY > 100 ? navElement.style.top = "0px" : navElement.style.top = "100px";
      this.scrollY > 100 ? navElement.style.height = "30px" : navElement.style.height = "inherit";
      this.scrollY > 100 ? listElement.style.lineHeight = "30px" : listElement.style.lineHeight = "50px";
      this.scrollY > 100 ? navElement.style.paddingTop = "10px" : navElement.style.paddingTop = "50px";
      this.scrollY > 100 ? navElement.style.paddingBottom = "30px" : navElement.style.paddingBottom = "50px";
      this.scrollY > 100 ? navElement.style.fontSize = "15px" : navElement.style.fontSize = "17px";
    }
    window.addEventListener("scroll", changeCss , false);
  }
  else {
    document.addEventListener("click", (e) => {
      const target = e.target;
      var i = document.getElementById("main-nav");
      if(target.closest("#main-nav a")) {
        i.style.display = "none";
      }
    });
  }
}

function monthChange() {
  var currentTime = new Date();
  var month = currentTime.getMonth() + 1;
  var total = month;

  // Summer
  if (total >= 6 && total <= 8)
  {
      document.getElementById("intro").style.backgroundImage = "url('images/Front_Banner_Summer.png')";
      document.getElementById("front-contact").style.backgroundImage = "url('images/Front_Contact_Summer.png')";
  }
  // Autumn
  else if (total >= 9 && total <= 11)
  {
      document.getElementById("intro").style.backgroundImage = "url('images/Front_Banner_Fall.png')";
      document.getElementById("front-contact").style.backgroundImage = "url('images/Front_Contact_Fall.png')";
  }
  // Winter
  else if (total == 12 || total == 1 || total == 2)
  {
      document.getElementById("intro").style.backgroundImage = "url('images/Front_Banner_Winter.png')";
      document.getElementById("front-contact").style.backgroundImage = "url('images/Front_Contact_Winter.png')";
  }
  // Spring
  else if (total >= 2 && total <= 6)
  {
      document.getElementById("intro").style.backgroundImage = "url('images/Front_Banner_Spring.png')";
      document.getElementById("front-contact").style.backgroundImage = "url('images/Front_Contact_Spring.png')";
  }
  else
  {
      document.getElementById("intro").style.backgroundImage = "url('images/Front_Contact_Summer.png')";
      document.getElementById("front-contact").style.backgroundImage = "url('images/Front_Contact_Summer.png')";

  }
}
