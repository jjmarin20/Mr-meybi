// Generador de cartas por moldes. Cero llamadas a modelos: la gramática la
// garantiza la estructura, no un filtro a posteriori.
//
// Registro: adivinanza clásica. Las cartas describen propiedades simples y
// concretas —se ve, pesa, suena, cabe— para que la respuesta quede abierta.
// "¿Qué es pesado y a veces no lo puedes ver?"
//
// Una carta derecha no guarda texto, guarda su ANATOMÍA: el texto se ajusta al
// conector al armar la pregunta, así que "nadie lo toca" y "nadie lo toque"
// son la misma carta vista por dos conectores distintos.

// ── 1. VOCABULARIO ────────────────────────────────────────────────────────

const ADJ = [
  "pesado", "ligero", "frío", "caliente", "blando", "duro", "ruidoso",
  "silencioso", "viejo", "nuevo", "redondo", "invisible", "pegajoso",
  "brillante", "oscuro", "diminuto", "enorme", "caro", "gratis", "peligroso",
  "lento", "rápido", "urgente", "común", "raro", "barato", "transparente",
  "sucio", "limpio", "torcido", "frágil", "eterno",
];

// Para "tiene" / "no tiene".
const NOUN_HAVE = [
  "forma", "color", "dueño", "precio", "nombre", "final", "arreglo",
  "sonido", "olor", "peso", "sombra", "puerta", "llave", "prisa",
];

// Infinitivos simples: la mano, el ojo, el oído.
const INF = [
  "ver", "tocar", "oír", "oler", "romper", "guardar", "contar", "mover",
  "comprar", "prestar", "esconder", "medir", "abrir", "llevar", "encontrar",
  "devolver", "repetir", "explicar",
];

// Propiedades completas, con su forma de subjuntivo escrita a mano: conjugar
// en código falla en los irregulares. En afirmativo siempre: "pesa poco" se
// entiende antes que "no pesa nada".
const PROP = [
  { i: "pesa poco", s: "pese poco" },
  { i: "hace ruido", s: "haga ruido" },
  { i: "brilla de noche", s: "brille de noche" },
  { i: "se moja", s: "se moje" },
  { i: "huele raro", s: "huela raro" },
  { i: "cabe en un bolsillo", s: "quepa en un bolsillo" },
  { i: "está en todas las casas", s: "esté en todas las casas" },
  { i: "desaparece con el sol", s: "desaparezca con el sol" },
  { i: "crece solo", s: "crezca solo" },
  { i: "se rompe fácil", s: "se rompa fácil" },
  { i: "vuelve cada año", s: "vuelva cada año" },
  { i: "suena mejor de noche", s: "suene mejor de noche" },
  { i: "se usa todos los días", s: "se use todos los días" },
  { i: "pasa de mano en mano", s: "pase de mano en mano" },
  { i: "se ve de lejos", s: "se vea de lejos" },
  { i: "cambia de color", s: "cambie de color" },
  { i: "ocupa sitio", s: "ocupe sitio" },
  { i: "se hereda", s: "se herede" },
  { i: "se paga dos veces", s: "se pague dos veces" },
  { i: "llega tarde", s: "llegue tarde" },
  { i: "cabe en una mano", s: "quepa en una mano" },
  { i: "viaja solo", s: "viaje solo" },
];

// Verbos con objeto para "nadie lo …".
const VERBS_TR = [
  { i: "toca", s: "toque", ip: "tocan", sp: "toquen" },
  { i: "ve", s: "vea", ip: "ven", sp: "vean" },
  { i: "usa", s: "use", ip: "usan", sp: "usen" },
  { i: "guarda", s: "guarde", ip: "guardan", sp: "guarden" },
  { i: "presta", s: "preste", ip: "prestan", sp: "presten" },
  { i: "quiere", s: "quiera", ip: "quieren", sp: "quieran" },
  { i: "entiende", s: "entienda", ip: "entienden", sp: "entiendan" },
  { i: "busca", s: "busque", ip: "buscan", sp: "busquen" },
  { i: "encuentra", s: "encuentre", ip: "encuentran", sp: "encuentren" },
  { i: "cuenta", s: "cuente", ip: "cuentan", sp: "cuenten" },
  { i: "recuerda", s: "recuerde", ip: "recuerdan", sp: "recuerden" },
  { i: "mueve", s: "mueva", ip: "mueven", sp: "muevan" },
  { i: "abre", s: "abra", ip: "abren", sp: "abran" },
  { i: "compra", s: "compre", ip: "compran", sp: "compren" },
  { i: "esconde", s: "esconda", ip: "esconden", sp: "escondan" },
  { i: "devuelve", s: "devuelva", ip: "devuelven", sp: "devuelvan" },
];

const WHO = [
  { t: "nadie", pl: false }, { t: "todos", pl: true }, { t: "casi nadie", pl: false },
  { t: "alguien", pl: false }, { t: "la gente", pl: false }, { t: "cada uno", pl: false },
  { t: "todo el mundo", pl: false }, { t: "los niños", pl: true },
];

const SUST = ["permiso", "ruido", "dueño", "precio", "luz", "agua", "manos", "prisa"];

const PERSONA = [
  "todos", "el que llega tarde", "quien lo encuentre",
  "el más pequeño", "quien no mira", "el de siempre", "una sola persona",
];

const LUGAR = [
  "la cocina", "el bolsillo", "la oscuridad", "verano", "invierno",
  "casa de otro", "el fondo", "la calle", "voz baja", "todas partes",
];

// ── 2. MOLDES ─────────────────────────────────────────────────────────────

const join = (parts) => parts.filter(Boolean).join(" ").replace(/\s+/g, " ").trim();

// Predicado corto en 3ª del singular: el sujeto lo pone la plantilla. En
// afirmativo: decir "es rápido" cuesta menos de leer que "no es lento".
const LEFT_MOLDS = [
  { id: "L-es", build: (r) => join(["es", r.pick(ADJ)]) },
  { id: "L-es2", build: (r) => join(["es", r.pick(ADJ)]) },
  { id: "L-tiene", build: (r) => join(["tiene", r.pick(NOUN_HAVE)]) },
  { id: "L-prop", build: (r) => r.pick(PROP).i },
  { id: "L-prop2", build: (r) => r.pick(PROP).i },
  { id: "L-puede", build: (r) => join(["se puede", r.pick(INF)]) },
];

const RIGHT_MOLDS = [
  {
    id: "R-nadie", tags: ["ind", "subj"], weight: 26,
    build: (r) => {
      const who = r.pick(WHO), v = r.pick(VERBS_TR);
      return {
        forms: {
          ind: join([who.t, "lo", who.pl ? v.ip : v.i]),
          subj: join([who.t, "lo", who.pl ? v.sp : v.s]),
        },
      };
    },
  },
  {
    id: "R-puedes", tags: ["ind", "subj"], weight: 18,
    build: (r) => {
      const inf = r.pick(INF), neg = r() < 0.35;
      return {
        forms: {
          ind: join([neg ? "no" : "", "lo puedes", inf]),
          // El subjuntivo va siempre en positivo: "sin que no lo puedas ver"
          // encadena dos negaciones y se vuelve ilegible.
          subj: join(["lo puedas", inf]),
        },
      };
    },
  },
  {
    id: "R-prop", tags: ["ind", "subj"], weight: 22,
    build: (r) => { const p = r.pick(PROP); return { forms: { ind: p.i, subj: p.s } }; },
  },
  { id: "R-inf", tags: ["inf"], weight: 8, build: (r) => ({ forms: { inf: r.pick(INF) + "lo" } }) },
  { id: "R-sust", tags: ["sust"], weight: 8, build: (r) => ({ forms: { sust: r.pick(SUST) } }) },
  { id: "R-persona", tags: ["persona"], weight: 9, build: (r) => ({ forms: { persona: r.pick(PERSONA) } }) },
  { id: "R-lugar", tags: ["lugar"], weight: 9, build: (r) => ({ forms: { lugar: r.pick(LUGAR) } }) },
];

// ── 3. CONECTORES ─────────────────────────────────────────────────────────
// accepts = formas que el conector admite a su derecha. comma = la frase pide
// coma antes ("es pesado, además nadie lo ve").

export const CONNECTOR_CARDS = [
  { id: "k-y", text: "y", accepts: ["ind"], tipo: "suma" },
  { id: "k-yademas", text: "y además", accepts: ["ind"], tipo: "suma" },
  { id: "k-ademas", text: "además", accepts: ["ind"], tipo: "suma", comma: true, conY: true },
  { id: "k-ytambien", text: "y también", accepts: ["ind"], tipo: "suma" },
  { id: "k-tambien", text: "también", accepts: ["ind"], tipo: "suma", comma: true, conY: true },
  { id: "k-incluso", text: "e incluso", accepts: ["ind"], tipo: "suma" },
  { id: "k-yencima", text: "y encima", accepts: ["ind"], tipo: "suma" },
  { id: "k-yhasta", text: "y hasta", accepts: ["ind"], tipo: "suma" },
  { id: "k-alavez", text: "y a la vez", accepts: ["ind"], tipo: "suma" },
  { id: "k-pero", text: "pero", accepts: ["ind"], tipo: "contraste" },
  { id: "k-aunque", text: "aunque", accepts: ["ind", "subj"], tipo: "contraste" },
  { id: "k-sinembargo", text: "sin embargo", accepts: ["ind"], tipo: "contraste", comma: true, conY: true },
  { id: "k-aunasi", text: "aun así", accepts: ["ind"], tipo: "contraste", comma: true, conY: true },
  { id: "k-ysinembargo", text: "y sin embargo", accepts: ["ind"], tipo: "contraste" },
  { id: "k-cuando", text: "cuando", accepts: ["ind"], tipo: "tiempo" },
  { id: "k-mientras", text: "mientras", accepts: ["ind"], tipo: "tiempo" },
  { id: "k-hastaque", text: "hasta que", accepts: ["ind"], tipo: "tiempo" },
  { id: "k-antesdeque", text: "antes de que", accepts: ["subj"], tipo: "tiempo" },
  { id: "k-cadavez", text: "cada vez que", accepts: ["ind"], tipo: "tiempo" },
  { id: "k-aveces", text: "a veces", accepts: ["ind"], tipo: "tiempo", comma: true, conY: true },
  { id: "k-si", text: "si", accepts: ["ind"], tipo: "condición" },
  { id: "k-inclusosi", text: "incluso si", accepts: ["ind"], tipo: "condición" },
  { id: "k-amenosque", text: "a menos que", accepts: ["subj"], tipo: "condición" },
  { id: "k-siempreque", text: "siempre que", accepts: ["subj"], tipo: "condición" },
  { id: "k-porque", text: "porque", accepts: ["ind"], tipo: "causa" },
  { id: "k-yaque", text: "ya que", accepts: ["ind"], tipo: "causa" },
  { id: "k-asique", text: "así que", accepts: ["ind"], tipo: "causa", comma: true },
  { id: "k-sinque", text: "sin que", accepts: ["subj"], tipo: "forma" },
  { id: "k-sin", text: "sin", accepts: ["inf", "sust"], tipo: "forma" },
  { id: "k-para", text: "para", accepts: ["persona"], tipo: "forma" },
  { id: "k-en", text: "en", accepts: ["lugar"], tipo: "forma" },
];

// ── 4. AZAR REPRODUCIBLE ─────────────────────────────────────────────────

export function makeRng(seed) {
  let a = (seed >>> 0) || 0x9e3779b9;
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  next.pick = (list) => list[Math.floor(next() * list.length)];
  return next;
}

// ── 5. CONSTRUCCIÓN DEL MAZO ──────────────────────────────────────────────

const slug = (t) => String(t).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
  .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

// Una carta no puede repetirse a sí misma: "se puede ver" + "se ve de lejos".
function selfEcho(text) {
  const seen = new Set();
  return String(text).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .split(/[^a-z]+/).filter((w) => w.length >= 3)
    .some((w) => { if (seen.has(w)) return true; seen.add(w); return false; });
}

export function buildDeck(options) {
  const o = options || {};
  const leftCount = o.left || 60;
  const rightCount = o.right || 60;
  const rng = o.rng || makeRng(o.seed || Date.now());

  const left = [];
  const seenL = new Set();
  let guard = leftCount * 80;
  while (left.length < leftCount && guard-- > 0) {
    const mold = rng.pick(LEFT_MOLDS);
    const text = mold.build(rng);
    if (!text || seenL.has(text) || selfEcho(text)) continue;
    seenL.add(text);
    left.push({ id: "fl-" + slug(text), text, mold: mold.id, clase: "abstracto" });
  }

  // Bolsa ponderada: los conectores raros necesitan al menos una carta suya,
  // los de indicativo se llevan el grueso.
  const bag = [];
  RIGHT_MOLDS.forEach((m) => { for (let i = 0; i < m.weight; i++) bag.push(m); });

  const right = [];
  const seenR = new Set();
  const perMold = {};
  const add = (mold, built) => {
    right.push({
      id: "fr-" + slug(Object.values(built.forms)[0]),
      forms: built.forms, tags: mold.tags, mold: mold.id, clase: "abstracto",
      text: built.forms[mold.tags[0]],
    });
    perMold[mold.id] = (perMold[mold.id] || 0) + 1;
  };

  guard = rightCount * 80;
  while (right.length < rightCount && guard-- > 0) {
    const mold = rng.pick(bag);
    const built = mold.build(rng);
    const key = Object.values(built.forms).join("|");
    if (seenR.has(key) || Object.values(built.forms).some(selfEcho)) continue;
    seenR.add(key);
    add(mold, built);
  }

  // Sin al menos una carta por forma, los conectores "sin", "para" y "en" se
  // quedan sin pareja y nunca pueden salir.
  RIGHT_MOLDS.forEach((m) => {
    for (let i = 0; i < 60 && !perMold[m.id]; i++) {
      const built = m.build(rng);
      const key = Object.values(built.forms).join("|");
      if (seenR.has(key)) continue;
      seenR.add(key);
      add(m, built);
    }
  });

  return { left, right, molds: perMold };
}

// ── 6. ARMADO DE LA PREGUNTA ──────────────────────────────────────────────
// Aquí ocurre el ajuste: primero se elige el conector, y la carta derecha se
// rinde en la forma que ese conector exige.

export function renderRight(card, tag) {
  if (!card) return "";
  if (card.forms) return card.forms[tag] || card.forms[card.tags[0]] || card.text || "";
  return card.text || "";
}

const LIGHT = new Set(["nadie", "todos", "nada", "algo", "alguien", "gente", "mundo",
  "cada", "todas", "otro", "lo", "se", "no", "mas", "una", "como", "para", "sin", "del", "que"]);

const words = (t) => String(t).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
  .split(/[^a-z]+/).filter((w) => w.length >= 4 && !LIGHT.has(w));

// Rechaza el eco: la misma raíz a los dos lados, o una carta que ya contiene
// la palabra con la que abre el conector ("sin ruido" + "sin que…").
function collides(leftText, rightText, conjunction) {
  const head = conjunction.text.split(" ")[0];
  if (head.length > 1) {
    const echo = new RegExp("(?:^|\\s)" + head + "(?:\\s|$)", "i");
    if (echo.test(leftText) || echo.test(rightText)) return true;
  }
  const rightStems = new Set(words(rightText).map((w) => w.slice(0, 5)));
  return words(leftText).some((w) => rightStems.has(w.slice(0, 5)));
}

export function assemble(deck, connectors, rng) {
  const rand = rng || makeRng(Date.now());
  const list = connectors && connectors.length ? connectors : CONNECTOR_CARDS;
  let chosen = null;
  let fallback = null;
  for (let i = 0; i < 60 && !chosen; i++) {
    const conjunction = rand.pick(list);
    const usable = deck.right.filter((c) => c.tags.some((t) => conjunction.accepts.includes(t)));
    if (!usable.length) continue;
    const left = rand.pick(deck.left);
    const right = rand.pick(usable);
    const tag = right.tags.find((t) => conjunction.accepts.includes(t)) || right.tags[0];
    const rightText = renderRight(right, tag);
    const combo = { left, conjunction, right, tag, rightText };
    if (!fallback) fallback = combo;
    if (!collides(left.text, rightText, conjunction)) chosen = combo;
  }
  const c = chosen || fallback;
  if (!c) return { question: "" };
  // Los conectores que piden coma también saben encadenarse con "y": la mitad
  // de las veces suena más hablado ("es pesado y a veces no lo puedes ver").
  const conY = c.conjunction.comma && c.conjunction.conY && rand() < 0.5;
  const text = conY ? "y " + c.conjunction.text : c.conjunction.text;
  const sep = c.conjunction.comma && !conY ? ", " : " ";
  return Object.assign({}, c, {
    conjunctionText: text,
    question: "¿Qué " + c.left.text + sep + text + " " + c.rightText + "?",
  });
}
