// Transport layer for the multi-device mode.
// Everything network-specific lives here: swapping PeerJS for a realtime
// database later means rewriting only this file, not the game UI.

const PREFIX = "srmeybi-";
const READY_TIMEOUT = 15000;

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no I, O, 0, 1

export function makeCode() {
  let out = "";
  for (let i = 0; i < 4; i++) out += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
  return out;
}

export function normalizeCode(raw) {
  return String(raw || "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 4);
}

function waitForPeer() {
  return new Promise((resolve, reject) => {
    const started = Date.now();
    (function poll() {
      if (window.Peer) return resolve(window.Peer);
      if (Date.now() - started > READY_TIMEOUT) return reject(new Error("no-peerjs"));
      setTimeout(poll, 120);
    })();
  });
}

// Host = the big screen. Owns the game state and broadcasts it to every phone.
export async function hostRoom(code, handlers) {
  const Peer = await waitForPeer();
  const peer = new Peer(PREFIX + code, { debug: 0 });
  const conns = new Map();
  let closed = false;

  peer.on("open", () => { if (!closed && handlers.onOpen) handlers.onOpen(code); });
  peer.on("error", (err) => { if (!closed && handlers.onError) handlers.onError(err); });

  peer.on("connection", (conn) => {
    conn.on("data", (msg) => {
      if (!msg || typeof msg !== "object") return;
      if (msg.type === "join") {
        conn.playerId = msg.player && msg.player.id;
        if (conn.playerId) conns.set(conn.playerId, conn);
      }
      if (handlers.onMessage) handlers.onMessage(msg, conn);
    });
    const drop = () => {
      if (conn.playerId && conns.get(conn.playerId) === conn) conns.delete(conn.playerId);
      if (handlers.onLeave && conn.playerId) handlers.onLeave(conn.playerId);
    };
    conn.on("close", drop);
    conn.on("error", drop);
  });

  return {
    kind: "host",
    broadcast(state) {
      conns.forEach((conn, playerId) => {
        try { conn.send({ type: "state", you: playerId, state }); } catch (e) {}
      });
    },
    sendTo(playerId, payload) {
      const conn = conns.get(playerId);
      if (conn) { try { conn.send(payload); } catch (e) {} }
    },
    close() {
      closed = true;
      conns.forEach((conn) => { try { conn.close(); } catch (e) {} });
      conns.clear();
      try { peer.destroy(); } catch (e) {}
    },
  };
}

// Phone = one player. Sends taps and point allocations, receives state.
export async function joinRoom(code, player, handlers) {
  const Peer = await waitForPeer();
  const peer = new Peer(undefined, { debug: 0 });
  let settled = false;
  let closed = false;

  await new Promise((resolve, reject) => {
    peer.on("open", () => { if (!settled) { settled = true; resolve(); } });
    peer.on("error", (err) => { if (!settled) { settled = true; reject(err); } });
  });

  const conn = peer.connect(PREFIX + code, { reliable: true });

  await new Promise((resolve, reject) => {
    let done = false;
    const timer = setTimeout(() => { if (!done) { done = true; reject(new Error("timeout")); } }, READY_TIMEOUT);
    conn.on("open", () => { if (!done) { done = true; clearTimeout(timer); resolve(); } });
    conn.on("error", (err) => { if (!done) { done = true; clearTimeout(timer); reject(err); } });
    peer.on("error", (err) => { if (!done) { done = true; clearTimeout(timer); reject(err); } });
  });

  conn.send({ type: "join", player });

  conn.on("data", (msg) => {
    if (!closed && msg && typeof msg === "object" && handlers.onMessage) handlers.onMessage(msg);
  });
  const drop = () => { if (!closed && handlers.onClose) handlers.onClose(); };
  conn.on("close", drop);
  peer.on("disconnected", drop);

  return {
    kind: "guest",
    send(payload) { try { conn.send(payload); } catch (e) {} },
    close() {
      closed = true;
      try { conn.close(); } catch (e) {}
      try { peer.destroy(); } catch (e) {}
    },
  };
}

// Draws a QR of `text` into a canvas using the qrcode-generator global.
export function drawQr(canvas, text, options) {
  const opts = options || {};
  const scale = opts.scale || 6;
  const quiet = opts.quiet === undefined ? 2 : opts.quiet;
  const dark = opts.dark || "#1b0d38";
  const light = opts.light || "#f9ecd0";
  if (!canvas || !window.qrcode) return false;
  let qr = null;
  for (let type = 3; type <= 12; type++) {
    try {
      const candidate = window.qrcode(type, "M");
      candidate.addData(text);
      candidate.make();
      qr = candidate;
      break;
    } catch (e) { /* text does not fit this version, try a bigger one */ }
  }
  if (!qr) return false;
  const count = qr.getModuleCount();
  const size = (count + quiet * 2) * scale;
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = light;
  ctx.fillRect(0, 0, size, size);
  ctx.fillStyle = dark;
  for (let row = 0; row < count; row++) {
    for (let col = 0; col < count; col++) {
      if (qr.isDark(row, col)) {
        ctx.fillRect((col + quiet) * scale, (row + quiet) * scale, scale, scale);
      }
    }
  }
  return true;
}

export function joinUrl(code) {
  const base = location.origin + location.pathname;
  return base + "?sala=" + code;
}

export function codeFromUrl() {
  const params = new URLSearchParams(location.search);
  return normalizeCode(params.get("sala"));
}
