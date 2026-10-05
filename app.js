const STOPS = [
  {
    id: "mexuar", name: "Mexuar", sub: "Council hall · public business",
    img: "images/mexuar.jpg", alt: "The Mexuar: a hall with colorful tile walls, slender columns and a carved wooden gallery",
    badge: [150, 232],
    look: ["Zellij tile dado", "Carved wooden gallery", "Slender columns", "Stucco calligraphy"],
    script: "Our tour begins where the sultan did business. In the Mexuar, ministers met and the sultan heard petitions and gave justice. Notice the bands of colorful star-pattern tiles along the walls and the Arabic inscriptions carved into the plaster above them.",
    fact: "After the Christian conquest in 1492, part of the Mexuar was converted into a chapel, one of many changes the new rulers made."
  },
  {
    id: "myrtles", name: "Court of the Myrtles", sub: "Comares Palace · Yusuf I, 1300s",
    img: "images/myrtles.jpg", alt: "Court of the Myrtles: a long reflecting pool lined with myrtle hedges, mirroring the Comares Tower",
    badge: [280, 150],
    look: ["Reflecting pool", "Myrtle hedges", "Arcades at each end", "Comares Tower"],
    script: "This is the heart of the official palace. The long, still pool acts like a mirror, doubling the arcades and the Comares Tower so the palace seems to float. The clipped myrtle hedges that give the court its name line both sides.",
    fact: "Water is everywhere in the Alhambra. It was carried uphill from the Darro River by the Acequia Real, the Royal Canal."
  },
  {
    id: "ambassadors", name: "Hall of the Ambassadors", sub: "Throne room · inside the Comares Tower",
    img: "images/ambassadors.jpg", alt: "Looking up at the carved cedar ceiling of the Hall of the Ambassadors, a pattern of thousands of wooden stars",
    badge: [285, 74],
    look: ["Cedar star ceiling", "Stucco calligraphy", "Window alcoves", "Sultan’s throne niche"],
    script: "Look up! This is the largest hall in the palaces and the sultan’s throne room, where he received foreign ambassadors. The carved cedar ceiling is built from thousands of wooden pieces forming stars, representing the seven heavens of Islamic tradition.",
    fact: "The hall sits inside the Comares Tower, the tallest tower in the Alhambra, so the throne room also had commanding views over Granada."
  },
  {
    id: "lions", name: "Court of the Lions", sub: "Private palace · Muhammad V, late 1300s",
    img: "images/lions.jpg", alt: "Court of the Lions: a courtyard of slender marble columns and lace-like arches around a fountain",
    badge: [392, 216],
    look: ["124 marble columns", "Fountain of 12 lions", "Four water channels", "Lace-like arches"],
    script: "Now we enter the sultan’s private palace. 124 slender white marble columns hold up arches carved like lace. In the center, twelve marble lions carry the fountain basin, and four channels of water divide the courtyard into four parts, like a paradise garden.",
    fact: "The four channels are often read as the four rivers of paradise described in Islamic tradition."
  },
  {
    id: "sisters", name: "Hall of the Two Sisters", sub: "Private hall · north of the Lions",
    img: "images/sisters.jpg", alt: "Looking up into the muqarnas dome of the Hall of the Two Sisters, an octagon of thousands of honeycomb cells",
    badge: [460, 130],
    look: ["Muqarnas dome", "Twin marble slabs", "Poetry on the walls", "Mirador de Lindaraja"],
    script: "Look up again: this is one of the most famous muqarnas domes in the world, made of thousands of small honeycomb cells that break the light into a glowing pattern. The hall is named for the two identical marble slabs set into the floor.",
    fact: "Verses by the court poet Ibn Zamrak run around the walls and even praise the dome above them. Our HGTV designers turned this room into a primary suite!"
  },
  {
    id: "generalife", name: "Generalife", sub: "Summer palace · Cerro del Sol",
    img: "images/generalife.jpg", alt: "The Generalife’s Water-Channel Courtyard: a long pool with fountain jets, gardens and arcades",
    badge: [790, 150],
    look: ["Water-Channel Courtyard", "Fountain jets", "Terraced gardens", "Views back to the palace"],
    script: "Our last stop is across the ravine on the Hill of the Sun. The Generalife was the sultans’ summer retreat. Its Water-Channel Courtyard, the Patio de la Acequia, is a long pool lined with arching fountain jets, flowers and arcades.",
    fact: "From here you get the best views back across to the palaces: the perfect place to sign the deal."
  }
];

const panel = document.getElementById("panel");
const progress = document.getElementById("progress");
const badges = document.getElementById("badges");
const visited = new Set();
let current = -1;

// number badges on the map
STOPS.forEach((s, i) => {
  const g = document.createElementNS("http://www.w3.org/2000/svg", "g");
  g.setAttribute("class", "badge");
  g.dataset.stop = s.id;
  g.setAttribute("transform", `translate(${s.badge[0]} ${s.badge[1]})`);
  g.setAttribute("aria-hidden", "true");
  g.innerHTML = `<circle class="pulse" r="16"></circle><circle r="16"></circle><text>${i + 1}</text>`;
  badges.appendChild(g);
});

function setHash(id) {
  if (location.hash !== "#" + id) history.replaceState(null, "", "#" + id);
}

function dots(i) {
  return `<div class="dots" aria-hidden="true">${STOPS.map((_, k) => `<span class="${k <= i ? "on" : ""}"></span>`).join("")}</div>`;
}

function renderIntro() {
  current = -1;
  panel.className = "panel intro fade-in";
  panel.innerHTML = `
    <div class="photo"><img src="images/myrtles.jpg" alt="Court of the Myrtles reflecting pool"></div>
    <div class="body">
      <h2>Welcome to the Alhambra</h2>
      <p class="lead">A 14th-century palace-city on Sabika Hill in Granada, Spain, built by the Nasrid dynasty. Your tour guides will walk you through six stops:</p>
      <ol>${STOPS.map(s => `<li>${s.name}</li>`).join("")}</ol>
      <div class="nav"><span></span><button class="btn primary" data-go="0">Start the tour →</button></div>
    </div>`;
  progress.textContent = "6 stops";
  setHash("start");
  updateMap();
}

function renderFinish() {
  current = STOPS.length;
  panel.className = "panel intro fade-in";
  panel.innerHTML = `
    <div class="photo"><img src="images/generalife.jpg" alt="The Generalife gardens"></div>
    <div class="body">
      <h2>Tour complete!</h2>
      <p class="lead">You’ve walked from the public council hall to the sultan’s private palaces and out to the summer gardens. Seven centuries of craftsmanship, all in one listing.</p>
      <p class="fact"><b>Roadrunners Realty:</b> ready to schedule your private showing.</p>
      <div class="nav"><button class="btn" data-go="${STOPS.length - 1}">← Back</button><button class="btn primary" data-go="intro">Restart tour</button></div>
    </div>`;
  progress.textContent = "Tour complete";
  setHash("end");
  updateMap();
}

function renderStop(i) {
  const s = STOPS[i];
  current = i;
  visited.add(s.id);
  panel.className = "panel fade-in";
  panel.innerHTML = `
    <div class="photo">
      <img src="${s.img}" alt="${s.alt}">
      <span class="stopnum">STOP ${String(i + 1).padStart(2, "0")}</span>
    </div>
    <div class="body">
      <h2>${s.name}</h2>
      <p class="sub">${s.sub}</p>
      <div><h3>Look for</h3><ul class="chips">${s.look.map(l => `<li>${l}</li>`).join("")}</ul></div>
      <div><h3>Tour guide</h3><p class="script">${s.script}</p></div>
      <p class="fact"><b>Did you know?</b> ${s.fact}</p>
      <div class="nav">
        <button class="btn" data-go="${i === 0 ? "intro" : i - 1}">← ${i === 0 ? "Start" : STOPS[i - 1].name}</button>
        ${dots(i)}
        <button class="btn primary" data-go="${i === STOPS.length - 1 ? "end" : i + 1}">${i === STOPS.length - 1 ? "Finish" : STOPS[i + 1].name} →</button>
      </div>
    </div>`;
  progress.textContent = `Stop ${i + 1} of ${STOPS.length}`;
  setHash(s.id);
  updateMap();
  // preload next photo
  if (STOPS[i + 1]) new Image().src = STOPS[i + 1].img;
}

function updateMap() {
  document.querySelectorAll("[data-stop]").forEach(el => {
    const id = el.dataset.stop;
    el.classList.toggle("visited", visited.has(id));
    el.classList.toggle("active", !!STOPS[current] && STOPS[current].id === id);
  });
}

function go(target) {
  if (target === "intro") return renderIntro();
  if (target === "end") return renderFinish();
  const i = typeof target === "number" ? target : STOPS.findIndex(s => s.id === target);
  if (i >= 0 && i < STOPS.length) renderStop(i);
}

document.addEventListener("click", e => {
  const btn = e.target.closest("[data-go]");
  if (btn) {
    e.preventDefault();
    const v = btn.dataset.go;
    go(/^\d+$/.test(v) ? Number(v) : v);
    return;
  }
  const room = e.target.closest("[data-stop]");
  if (room) {
    go(room.dataset.stop);
    if (window.matchMedia("(max-width: 920px)").matches) panel.scrollIntoView({ behavior: "smooth", block: "start" });
  }
});

document.querySelectorAll(".room").forEach(r => {
  r.addEventListener("keydown", e => {
    if (e.key === "Enter" || e.key === " ") { e.preventDefault(); go(r.dataset.stop); }
  });
});

document.addEventListener("keydown", e => {
  if (e.target.closest(".room")) return;
  if (e.key === "ArrowRight") current === -1 ? go(0) : current < STOPS.length - 1 ? go(current + 1) : go("end");
  if (e.key === "ArrowLeft") current <= 0 ? go("intro") : current >= STOPS.length ? go(STOPS.length - 1) : go(current - 1);
});

// start from the URL hash (e.g. #lions) so a slide can link straight to a stop
const start = location.hash.slice(1);
if (STOPS.some(s => s.id === start)) go(start);
else if (start === "end") renderFinish();
else renderIntro();
