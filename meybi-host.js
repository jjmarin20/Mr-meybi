// Comentarista local de Señor Meybi. Cero llamadas a modelos: comenta hechos
// que el juego ya mide —quién ganó, por cuánto, con cuántas palabras, si
// alguien remontó— y los viste con la voz del presentador.
//
// No juzga: los puntos los reparte el juez humano. Esto solo reacciona.

// ── 1. LECTURA DE LA RONDA ────────────────────────────────────────────────
// Convierte la ronda en hechos objetivos. Todo lo que el comentarista sabe
// sale de aquí: si un dato no está en esta función, ninguna frase puede
// inventárselo.

export function readRound(input) {
  const answers = (input.answers || []).filter((a) => a && a.id);
  const alloc = input.allocation || {};
  // words = 0 cuando la respuesta fue oral (modo local): las reglas que hablan
  // de palabras se desactivan solas.
  const scored = answers
    .map((a) => {
      const text = String(a.text || "").trim();
      return { ...a, text, points: alloc[a.id] || 0, words: text ? text.split(/\s+/).length : 0 };
    })
    .sort((x, y) => y.points - x.points);

  const winners = scored.filter((a) => a.points > 0 && a.points === scored[0].points);
  const zeroes = scored.filter((a) => a.points === 0);
  const total = scored.reduce((sum, a) => sum + a.points, 0);
  const top = scored[0] || null;
  const second = scored.find((a) => a.points < (top ? top.points : 0)) || null;

  const written = scored.filter((a) => a.words > 0);
  const shortest = written.slice().sort((x, y) => x.words - y.words)[0] || null;
  const longest = written.slice().sort((x, y) => y.words - x.words)[0] || null;

  // Dos respuestas que comparten una palabra larga: la mesa pensó parecido.
  let twins = null;
  const key = (t) => t.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .split(/[^a-z]+/).filter((w) => w.length >= 5);
  for (let i = 0; i < written.length && !twins; i++) {
    for (let j = i + 1; j < written.length && !twins; j++) {
      const shared = key(written[i].text).find((w) => key(written[j].text).includes(w));
      if (shared) twins = { a: written[i], b: written[j], word: shared };
    }
  }

  return {
    scored, winners, zeroes, total, top, second, shortest, longest, twins,
    sweep: !!(top && top.points === total && total > 1),
    split: winners.length > 1,
    oneWord: !!(shortest && shortest.words === 1),
    everyoneScored: zeroes.length === 0 && scored.length > 1,
    roundNumber: input.roundNumber || 0,
    lastRound: !!input.lastRound,
    // Remontada: el ganador iba último antes de esta ronda.
    comeback: !!(top && input.standings && input.standings.length > 1 &&
      input.standings[input.standings.length - 1] === top.id && top.points > 0),
    leaderStreak: input.leaderStreak || 0,
  };
}

// ── 2. FRASES ─────────────────────────────────────────────────────────────
// Cada regla declara cuándo aplica y qué dice. Se evalúan de arriba abajo:
// las situaciones raras van primero para que no las tape una frase genérica.
// {g} = ganador · {b} = segundo · {p} = puntos · {n} = palabras · {w} = palabra

const RULES = [
  {
    id: "sweep-oneword",
    when: (r) => r.sweep && r.top.words === 1,
    lines: [
      "¡UNA PALABRA! ¡{g} se lleva los {p} puntos con UNA sola palabra!",
      "¡{g} dijo una palabra y se acabó la discusión! ¡{p} puntos!",
      "¡Una palabra, señoras y señores! ¡{p} puntos para {g}!",
    ],
  },
  {
    id: "sweep",
    when: (r) => r.sweep,
    lines: [
      "¡{p} puntos de {p} para {g}! ¡Eso no lo discute nadie!",
      "¡Barrida limpia! ¡{g} se lo lleva todo!",
      "¡{g} arrasó! ¡Los {p} puntos para una sola persona!",
      "¡Ni sombra de duda! ¡{p} puntazos para {g}!",
    ],
  },
  {
    id: "comeback",
    when: (r) => r.comeback,
    lines: [
      "¡{g} venía del último puesto y ahora mírenlo! ¡{p} puntos!",
      "¡LA REMONTADA! ¡{g} estaba en el fondo y sube con {p}!",
      "¡Nadie contaba con {g}! ¡Y se lleva {p}!",
    ],
  },
  {
    id: "twins",
    when: (r) => r.twins && r.twins.a.points > 0,
    lines: [
      "¡{g} y {b} pensaron lo mismo! ¡Los dos dijeron «{w}»!",
      "¡Dos cabezas, una sola idea! «{w}» por partida doble.",
      "¡Se copiaron sin mirarse! «{w}» en dos respuestas.",
    ],
  },
  {
    id: "split",
    when: (r) => r.split,
    lines: [
      "¡Empate en lo más alto! ¡El juez no se decidió y repartió!",
      "¡Dos ganadores! ¡Hoy el juez tenía el corazón blando!",
      "¡Nadie se puso de acuerdo! ¡Puntos para {g} y compañía!",
    ],
  },
  {
    id: "oneword-wins",
    when: (r) => r.top && r.top.points > 0 && r.top.words === 1,
    lines: [
      "¡{g} con UNA palabra y se lleva {p}! ¡Economía pura!",
      "¡Una palabra bastó! {p} para {g}.",
    ],
  },
  {
    id: "long-loses",
    when: (r) => r.longest && r.longest.points === 0 && r.longest.words >= 8,
    lines: [
      "¡{l} escribió {n} palabras y se fue con cero! ¡La vida es injusta!",
      "¡{n} palabras, {l}! ¡Y ni un punto! ¡Menos es más!",
      "¡{l} nos contó una novela entera… y nada!",
    ],
  },
  {
    id: "shutout",
    when: (r) => r.zeroes.length >= 2 && r.top && r.top.points > 0,
    lines: [
      "¡{z} se van con las manos vacías! ¡Otra vez será!",
      "¡Cero para {z}! ¡Duele, pero así es el show!",
      "¡{g} arriba y {z} mirando desde abajo!",
    ],
  },
  {
    id: "everyone",
    when: (r) => r.everyoneScored,
    lines: [
      "¡Puntos para todos! ¡Hoy nadie se va con las manos vacías!",
      "¡Repartido entre todos! ¡Qué generosidad!",
      "¡Nadie en cero! ¡Esta mesa está encendida!",
    ],
  },
  {
    id: "last-round",
    when: (r) => r.lastRound,
    lines: [
      "¡Última ronda y {g} aprieta con {p}!",
      "¡Se acaba el juego y {g} da el último zarpazo!",
    ],
  },
  {
    id: "generic",
    when: () => true,
    lines: [
      "¡{p} para {g}! ¡Así se hace!",
      "¡{g} se lleva {p}! ¡Y seguimos!",
      "¡Ahí está! ¡{p} puntos para {g}!",
      "¡{g} sube al marcador! ¡{p} puntos!",
      "¡Eso ha estado bien, {g}! ¡{p} puntos!",
      "¿La respuesta? ¡Puede ser! Pero {p} puntos para {g}.",
    ],
  },
];

// ── 3. ELECCIÓN ───────────────────────────────────────────────────────────

function fill(line, r) {
  const list = (arr) => arr.map((a) => a.name).filter(Boolean);
  const names = (arr) => {
    const l = list(arr);
    if (l.length <= 1) return l[0] || "";
    return l.slice(0, -1).join(", ") + " y " + l[l.length - 1];
  };
  return line
    .replace(/\{g\}/g, r.top ? r.top.name : "")
    .replace(/\{b\}/g, r.twins ? r.twins.b.name : (r.second ? r.second.name : ""))
    .replace(/\{p\}/g, r.top ? String(r.top.points) : "0")
    .replace(/\{w\}/g, r.twins ? r.twins.word : "")
    .replace(/\{l\}/g, r.longest ? r.longest.name : "")
    .replace(/\{n\}/g, r.longest ? String(r.longest.words) : "")
    .replace(/\{z\}/g, names(r.zeroes));
}

// recent = ids de frases ya usadas en la partida, para no repetir.
export function comment(input, recent) {
  const r = readRound(input);
  if (!r.top || !r.top.points) return { id: "none", text: "¡Se acabó la ronda! ¡Seguimos!" };

  const used = recent || [];
  const matching = RULES.filter((rule) => {
    try { return rule.when(r); } catch (err) { return false; }
  });
  // Primero las reglas que aún no han salido; la genérica solo si no hay otra.
  const fresh = matching.filter((rule) => used.indexOf(rule.id) < 0);
  const rule = (fresh.length ? fresh : matching)[0] || RULES[RULES.length - 1];

  // Dentro de la regla, una línea que no se haya oído.
  const lineKey = (i) => rule.id + "#" + i;
  const options = rule.lines.map((line, i) => ({ line, key: lineKey(i) }));
  const unheard = options.filter((o) => used.indexOf(o.key) < 0);
  const pool = unheard.length ? unheard : options;
  const pick = pool[Math.floor(Math.random() * pool.length)];

  return { id: rule.id, lineKey: pick.key, text: fill(pick.line, r) };
}

// ── CEREMONIA FINAL ───────────────────────────────────────────────────────
// Frases de presentador para el reparto de premios. Sin modelos: plantillas
// con hueco para el nombre y el título del premio.

const OPENERS = [
  "¡SEÑORAS Y SEÑORES! Antes de cerrar, quedan premios por repartir.",
  "¡UN MOMENTO! No se levanten. Falta lo más importante.",
  "¡ATENCIÓN! El jurado, o sea yo, tiene dos sobres en la mano.",
  "¡NO SE VAYAN! Todavía tengo puntos escondidos en el bolsillo.",
];

const PRESENTS = [
  "Y el premio {t} es para… ¡{n}!",
  "{t}. Sin discusión. ¡{n}!",
  "He aquí {t}: ¡{n}, esto es tuyo!",
  "El sobre dice {t}… ¡y dentro está {n}!",
];

const CLOSERS = [
  "¡Y con eso se cierra el reparto! Vamos con el marcador final.",
  "¡Ya no queda nada en el bolsillo! A ver cómo quedó todo.",
  "¡Premios entregados! Ahora sí, el momento de la verdad.",
  "¡Se acabaron los sobres! Veamos quién se lleva la noche.",
];

const pickFrom = (list, seed) => list[Math.abs(seed) % list.length];

// awards = lo que devuelve grantAwards. Devuelve una frase por paso: apertura,
// una por premio, y cierre.
export function awardLines(awards, seed) {
  const s = seed === undefined ? Date.now() : seed;
  const lines = [{ kind: "open", text: pickFrom(OPENERS, s) }];
  (awards || []).forEach((a, i) => {
    lines.push({
      kind: "award",
      award: a,
      text: pickFrom(PRESENTS, s + i * 7)
        .replace(/\{t\}/g, a.title)
        .replace(/\{n\}/g, a.name),
    });
  });
  lines.push({ kind: "close", text: pickFrom(CLOSERS, s + 3) });
  return lines;
}
