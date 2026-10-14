// Premios finales del Señor Meybi. Cero llamadas a modelos: cada categoría es
// una medida objetiva sobre el registro de la partida.
//
// Regla común: si no hay un ganador ÚNICO, la categoría no se entrega. Un
// premio empatado no tiene gracia y además decidiría la partida al azar.

// Lista del usuario. Se compara sin tildes y por raíz, así que "maricón" y
// "maricon" cuentan igual, y "putas" cuenta como "puta".
export const TABOO = [
  "pene", "culo", "vagina", "testiculo", "menstruacion", "peo", "moco",
  "orina", "sexo", "puta", "perra", "gay", "lesbiana", "puto", "maricon",
  "marica",
];

const flat = (t) => String(t || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
const wordsOf = (t) => flat(t).split(/[^a-z]+/).filter(Boolean);
const bigWords = (t) => wordsOf(t).filter((w) => w.length >= 5);

// Devuelve el id con el valor más alto, o null si hay empate arriba.
function soleTop(scores, min) {
  const ids = Object.keys(scores);
  if (!ids.length) return null;
  const best = Math.max(...ids.map((id) => scores[id]));
  if (min !== undefined && best < min) return null;
  const top = ids.filter((id) => scores[id] === best);
  return top.length === 1 ? top[0] : null;
}

function soleBottom(scores, ids) {
  const list = ids || Object.keys(scores);
  if (list.length < 2) return null;
  const worst = Math.min(...list.map((id) => scores[id]));
  const bottom = list.filter((id) => scores[id] === worst);
  return bottom.length === 1 ? bottom[0] : null;
}

// ── CATEGORÍAS ────────────────────────────────────────────────────────────
// log = [{ roundNumber, answers: {id: texto}, tapOrder: [id], allocation: {id: pts}, judgeIds: [id] }]
// players = [{ id, name }]
// needsText: la categoría lee lo que escribieron, así que solo existe en el
// modo de móviles. En local las respuestas son orales y no hay nada que medir.

export const CATEGORIES = [
  {
    id: "incomprendido",
    title: "EL INCOMPRENDIDO",
    line: "{n} respondió todas las rondas y casi nadie le dio nada.",
    consolation: true,
    find: (ctx) => {
      const eligible = ctx.ids.filter((id) => ctx.roundsPlayed[id] >= ctx.log.length - 1 && ctx.roundsPlayed[id] > 0);
      if (eligible.length < 2) return null;
      const id = soleBottom(ctx.points, eligible);
      return id && ctx.points[id] < Math.max(...eligible.map((x) => ctx.points[x])) ? id : null;
    },
  },
  {
    id: "gatillo",
    title: "EL GATILLO RÁPIDO",
    line: "{n} fue el primero en contestar {v} veces.",
    find: (ctx) => soleTop(ctx.firstCount, 2),
    value: (ctx, id) => ctx.firstCount[id],
  },
  {
    id: "shakespeare",
    title: "SHAKESPEARE",
    line: "{n} escribió {v} palabras por respuesta. Nadie pidió tanto.",
    needsText: true,
    find: (ctx) => soleTop(ctx.avgWords, 6),
    value: (ctx, id) => Math.round(ctx.avgWords[id]),
  },
  {
    id: "telegrama",
    title: "EL TELEGRAMA",
    line: "{n} respondió con {v} palabras de media. Ni una de más.",
    needsText: true,
    find: (ctx) => {
      const eligible = ctx.ids.filter((id) => ctx.avgWords[id] > 0);
      if (eligible.length < 2) return null;
      const id = soleBottom(ctx.avgWords, eligible);
      return id && ctx.avgWords[id] <= 3 ? id : null;
    },
    value: (ctx, id) => Math.round(ctx.avgWords[id] * 10) / 10,
  },
  {
    id: "bocasucia",
    title: "BOCA SUCIA",
    line: "{n} no se cortó ni una vez. {v} veces se pasó de la raya.",
    needsText: true,
    find: (ctx) => soleTop(ctx.taboo, 1),
    value: (ctx, id) => ctx.taboo[id],
  },
  {
    id: "monotematico",
    title: "EL MONOTEMÁTICO",
    line: "{n} dijo «{w}» en {v} rondas distintas. Ya sabemos en qué piensa.",
    needsText: true,
    find: (ctx) => soleTop(ctx.repeatBest, 2),
    value: (ctx, id) => ctx.repeatBest[id],
    extra: (ctx, id) => ({ w: ctx.repeatWord[id] || "" }),
  },
  {
    id: "iman",
    title: "EL IMÁN",
    line: "{n} pensó lo mismo que los demás {v} veces.",
    needsText: true,
    find: (ctx) => soleTop(ctx.twins, 2),
    value: (ctx, id) => ctx.twins[id],
  },
  {
    id: "remontada",
    title: "LA REMONTADA",
    line: "{n} iba último a mitad de partida y acabó arriba.",
    find: (ctx) => soleTop(ctx.climb, 2),
  },
  {
    id: "constante",
    title: "EL CONSTANTE",
    line: "{n} puntuó en todas las rondas y no ganó ninguna. El eterno segundo.",
    consolation: true,
    find: (ctx) => {
      const eligible = ctx.ids.filter((id) => ctx.scoredRounds[id] === ctx.log.length && !ctx.wonAny[id]);
      return eligible.length === 1 && ctx.log.length >= 3 ? eligible[0] : null;
    },
  },
  {
    id: "fantasma",
    title: "EL FANTASMA",
    line: "{n} se quedó en blanco {v} rondas. ¿Sigue ahí?",
    consolation: true,
    find: (ctx) => soleTop(ctx.silent, 2),
    value: (ctx, id) => ctx.silent[id],
  },
];

// ── LECTURA DE LA PARTIDA ─────────────────────────────────────────────────

function buildContext(log, players) {
  const ids = players.map((p) => p.id);
  const zero = () => { const o = {}; ids.forEach((id) => { o[id] = 0; }); return o; };
  const ctx = {
    log, ids,
    points: zero(), firstCount: zero(), taboo: zero(), twins: zero(),
    silent: zero(), scoredRounds: zero(), roundsPlayed: zero(), wonAny: {},
    climb: zero(), avgWords: zero(), repeatBest: zero(), repeatWord: {},
  };
  const wordTotal = zero();
  const answered = zero();
  const seenWords = {};
  ids.forEach((id) => { seenWords[id] = {}; });

  const running = zero();
  const halfway = Math.ceil(log.length / 2);
  const midRank = {};

  log.forEach((round, index) => {
    const alloc = round.allocation || {};
    const answers = round.answers || {};
    const judges = round.judgeIds || [];
    const best = Math.max(0, ...Object.values(alloc));

    ids.forEach((id) => {
      if (judges.indexOf(id) >= 0) return;
      ctx.roundsPlayed[id] += 1;
      const pts = alloc[id] || 0;
      ctx.points[id] += pts;
      running[id] += pts;
      if (pts > 0) ctx.scoredRounds[id] += 1;
      if (pts > 0 && pts === best) ctx.wonAny[id] = true;

      const text = answers[id];
      if (text === undefined) return;
      if (!String(text).trim()) { ctx.silent[id] += 1; return; }
      answered[id] += 1;
      wordTotal[id] += String(text).trim().split(/\s+/).length;

      const flatWords = wordsOf(text);
      flatWords.forEach((w) => {
        if (TABOO.some((t) => w.indexOf(t) === 0)) ctx.taboo[id] += 1;
      });
      // Una palabra larga cuenta una vez por ronda, no por repetirla en la
      // misma frase.
      new Set(bigWords(text)).forEach((w) => {
        seenWords[id][w] = (seenWords[id][w] || 0) + 1;
      });
    });

    // Coincidencias entre jugadores dentro de la ronda.
    const present = ids.filter((id) => answers[id] && String(answers[id]).trim());
    for (let i = 0; i < present.length; i++) {
      for (let j = i + 1; j < present.length; j++) {
        const a = new Set(bigWords(answers[present[i]]));
        const shared = bigWords(answers[present[j]]).some((w) => a.has(w));
        if (shared) { ctx.twins[present[i]] += 1; ctx.twins[present[j]] += 1; }
      }
    }

    // Quién pulsó primero.
    const order = round.tapOrder || [];
    if (order.length) ctx.firstCount[order[0]] = (ctx.firstCount[order[0]] || 0) + 1;

    if (index === halfway - 1) {
      const sorted = ids.slice().sort((a, b) => running[b] - running[a]);
      sorted.forEach((id, pos) => { midRank[id] = pos; });
    }
  });

  const finalSorted = ids.slice().sort((a, b) => ctx.points[b] - ctx.points[a]);
  finalSorted.forEach((id, pos) => {
    ctx.climb[id] = (midRank[id] === undefined ? pos : midRank[id]) - pos;
  });

  ids.forEach((id) => {
    ctx.avgWords[id] = answered[id] ? wordTotal[id] / answered[id] : 0;
    const entries = Object.entries(seenWords[id]).sort((a, b) => b[1] - a[1])[0];
    if (entries) { ctx.repeatBest[id] = entries[1]; ctx.repeatWord[id] = entries[0]; }
  });

  return ctx;
}

// ── ENTREGA ───────────────────────────────────────────────────────────────
// Devuelve hasta `count` premios con ganador único, elegidos al azar entre los
// que aplican. Cada uno vale 1 punto y se suma antes de coronar.

export function grantAwards(log, players, options) {
  const o = options || {};
  const count = o.count || 2;
  const hasText = !!o.hasText;
  if (!log || log.length < 2 || players.length < 2) return [];

  const ctx = buildContext(log, players);
  const byId = {};
  players.forEach((p) => { byId[p.id] = p; });

  // Quien va primero antes de los premios no puede recibir uno de consolación:
  // "casi nadie le dio nada" junto a la insignia GANADOR se contradice.
  const best = Math.max(...players.map((p) => p.score || 0));
  const leaders = players.filter((p) => (p.score || 0) === best).map((p) => p.id);

  const pool = CATEGORIES
    .filter((c) => hasText || !c.needsText)
    .map((c) => {
      let winner = null;
      try { winner = c.find(ctx); } catch (err) { winner = null; }
      if (!winner || !byId[winner]) return null;
      if (c.consolation && leaders.indexOf(winner) >= 0) return null;
      const v = c.value ? c.value(ctx, winner) : null;
      const extra = c.extra ? c.extra(ctx, winner) : {};
      const text = c.line
        .replace(/\{n\}/g, byId[winner].name)
        .replace(/\{v\}/g, v === null ? "" : String(v))
        .replace(/\{w\}/g, extra.w || "")
        // Concordancia: "1 palabras" delata la plantilla.
        .replace(/\b1 palabras\b/g, "una palabra")
        .replace(/\b1 veces\b/g, "una vez")
        .replace(/\b1 rondas\b/g, "una ronda");
      return { id: c.id, title: c.title, playerId: winner, name: byId[winner].name, text, points: 1 };
    })
    .filter(Boolean);

  // Barajado: la misma partida no reparte siempre los mismos premios.
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const t = pool[i]; pool[i] = pool[j]; pool[j] = t;
  }

  // Nunca dos premios para la misma persona: si no hay un segundo ganador
  // distinto, se entrega uno solo.
  const chosen = [];
  const taken = new Set();
  pool.forEach((a) => {
    if (chosen.length >= count || taken.has(a.playerId)) return;
    chosen.push(a); taken.add(a.playerId);
  });
  return chosen;
}
