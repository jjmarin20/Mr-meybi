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

// The signalling broker can drop a peer at any time (idle sockets, network
// blips). Direct phone<->host links survive that, but new phones can only find
// the room while the host is registered again. This keeps the peer registered,
// retrying with backoff until it succeeds or the room is closed.
function keepBrokerAlive(peer, isClosed, onDown) {
  let timer = null;
  let tries = 0;
  const arm = () => {
    if (isClosed() || timer || peer.destroyed || !peer.disconnected) return;
    if (onDown) onDown();
    const wait = Math.min(1000 * 2 ** tries, 10000);
    tries += 1;
    timer = setTimeout(() => {
      timer = null;
      if (isClosed() || peer.destroyed || !peer.disconnected) return;
      try { peer.reconnect(); } catch (e) { arm(); }
    }, wait);
  };
  peer.on("disconnected", arm);
  peer.on("error", arm);
  peer.on("open", () => { tries = 0; });
  return () => { if (timer) clearTimeout(timer); timer = null; };
}

// Host = the big screen. Owns the game state and broadcasts it to every phone.
export async function hostRoom(code, handlers) {
  const Peer = await waitForPeer();
  const peer = new Peer(PREFIX + code, { debug: 0 });
  const conns = new Map();
  let closed = false;
  let opened = false;
  const stopBroker = keepBrokerAlive(peer, () => closed, () => {
    if (!closed && handlers.onStatus) handlers.onStatus("connecting");
  });

  peer.on("open", () => {
    opened = true;
    if (!closed && handlers.onOpen) handlers.onOpen(code);
  });
  peer.on("error", (err) => {
    // Once the room is up, broker errors are retried by keepBrokerAlive.
    if (!closed && !opened && handlers.onError) handlers.onError(err);
  });

  peer.on("connection", (conn) => {
    conn.on("data", (msg) => {
      if (!msg || typeof msg !== "object") return;
      if (msg.type === "join") {
        conn.playerId = msg.player && msg.player.id;
        if (conn.playerId) {
          const old = conns.get(conn.playerId);
          if (old && old !== conn) { try { old.close(); } catch (e) {} }
          conns.set(conn.playerId, conn);
        }
      }
      if (handlers.onMessage) handlers.onMessage(msg, conn);
    });
    const drop = () => {
      // Only the phone's current link counts: an old link closing after the
      // same player rejoined must not mark that player as gone.
      const wasCurrent = !!conn.playerId && conns.get(conn.playerId) === conn;
      if (wasCurrent) conns.delete(conn.playerId);
      if (wasCurrent && handlers.onLeave) handlers.onLeave(conn.playerId);
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
    // Sends the same payload to every connected phone (used for photos).
    broadcastRaw(payload) {
      conns.forEach((conn) => { try { conn.send(payload); } catch (e) {} });
    },
    sendTo(playerId, payload) {
      const conn = conns.get(playerId);
      if (conn) { try { conn.send(payload); } catch (e) {} }
    },
    close() {
      closed = true;
      stopBroker();
      conns.forEach((conn) => { try { conn.close(); } catch (e) {} });
      conns.clear();
      try { peer.destroy(); } catch (e) {}
    },
  };
}

// Resolves when the peer is registered with the broker again.
function waitPeerOpen(peer) {
  if (peer.open) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => { peer.off("open", onOpen); reject(new Error("broker")); }, READY_TIMEOUT);
    const onOpen = () => { clearTimeout(timer); resolve(); };
    peer.once("open", onOpen);
  });
}

// Phone = one player. Sends taps and point allocations, receives state.
// If the link drops (screen off, network change), it reconnects with the same
// player id, so the host puts the player back in the game.
export async function joinRoom(code, player, handlers) {
  const Peer = await waitForPeer();
  const peer = new Peer(undefined, { debug: 0 });
  let closed = false;
  let reconnecting = false;
  let conn = null;
  const stopBroker = keepBrokerAlive(peer, () => closed);

  await new Promise((resolve, reject) => {
    let settled = false;
    peer.on("open", () => { if (!settled) { settled = true; resolve(); } });
    peer.on("error", (err) => { if (!settled) { settled = true; reject(err); } });
  });

  function openConnection() {
    return new Promise((resolve, reject) => {
      const c = peer.connect(PREFIX + code, { reliable: true });
      let done = false;
      const timer = setTimeout(() => {
        if (!done) { done = true; try { c.close(); } catch (e) {} reject(new Error("timeout")); }
      }, READY_TIMEOUT);
      c.on("open", () => { if (!done) { done = true; clearTimeout(timer); resolve(c); } });
      c.on("error", (err) => { if (!done) { done = true; clearTimeout(timer); reject(err); } });
    });
  }

  function attach(c) {
    conn = c;
    let gone = false;
    const lost = () => {
      if (gone || closed || conn !== c) return;
      gone = true;
      reconnect();
    };
    c.on("data", (msg) => {
      if (!closed && conn === c && msg && typeof msg === "object" && handlers.onMessage) handlers.onMessage(msg);
    });
    c.on("close", lost);
    c.on("error", lost);
    c.send({ type: "join", player });
  }

  async function reconnect() {
    if (closed || reconnecting) return;
    reconnecting = true;
    if (handlers.onReconnecting) handlers.onReconnecting();
    const MAX_ATTEMPTS = 8;
    for (let attempt = 0; attempt < MAX_ATTEMPTS && !closed; attempt++) {
      await new Promise((r) => setTimeout(r, Math.min(1000 * 2 ** attempt, 8000)));
      if (closed) break;
      try {
        await waitPeerOpen(peer);
        const c = await openConnection();
        if (closed) { try { c.close(); } catch (e) {} break; }
        attach(c);
        reconnecting = false;
        if (handlers.onReconnected) handlers.onReconnected();
        return;
      } catch (e) { /* try again */ }
    }
    reconnecting = false;
    if (!closed && handlers.onClose) handlers.onClose();
  }

  attach(await openConnection());

  return {
    kind: "guest",
    send(payload) { try { if (conn) conn.send(payload); } catch (e) {} },
    close() {
      closed = true;
      stopBroker();
      try { if (conn) conn.close(); } catch (e) {}
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
