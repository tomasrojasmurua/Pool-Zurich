// Multijugador online con PeerJS (conexión directa entre los dos celulares)
const Net = (() => {
  const PREFIX = 'pool-zurich-sala-';
  let peer = null, conn = null, handlers = {};

  const code = () => {
    const abc = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
    let s = '';
    for (let i = 0; i < 4; i++) s += abc[Math.floor(Math.random() * abc.length)];
    return s;
  };

  function wire(c) {
    conn = c;
    c.on('open', () => handlers.open && handlers.open());
    c.on('data', d => handlers.data && handlers.data(d));
    c.on('close', () => handlers.close && handlers.close());
    c.on('error', () => handlers.close && handlers.close());
  }

  function host(h) {
    handlers = h;
    const room = code();
    peer = new Peer(PREFIX + room);
    peer.on('open', () => h.room && h.room(room));
    peer.on('connection', c => { if (conn) { c.close(); return; } wire(c); });
    peer.on('error', e => {
      if (e.type === 'unavailable-id') { leave(); host(h); return; }
      h.error && h.error(e);
    });
  }

  function join(room, h) {
    handlers = h;
    peer = new Peer();
    peer.on('open', () => wire(peer.connect(PREFIX + room.toUpperCase(), { reliable: true })));
    peer.on('error', e => h.error && h.error(e));
  }

  function send(d) { if (conn && conn.open) conn.send(d); }

  function leave() {
    try { conn && conn.close(); } catch (e) {}
    try { peer && peer.destroy(); } catch (e) {}
    conn = null; peer = null;
  }

  return { host, join, send, leave };
})();
