// Multijugador online con PeerJS. El anfitrión recibe hasta 3 invitados
// y reenvía a todos lo que manda cada uno (conexión en estrella).
const Net = (() => {
  const PREFIX = 'pool-zurich-sala-';
  const MAX_GUESTS = 3;
  let peer = null, conns = [], handlers = {}, isHost = false;

  const code = () => {
    const abc = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
    let s = '';
    for (let i = 0; i < 4; i++) s += abc[Math.floor(Math.random() * abc.length)];
    return s;
  };

  const count = () => conns.filter(c => c.open).length + 1;

  function host(h) {
    handlers = h; isHost = true; conns = [];
    const room = code();
    peer = new Peer(PREFIX + room);
    peer.on('open', () => h.room && h.room(room));
    peer.on('connection', c => {
      if (conns.length >= MAX_GUESTS || h.locked && h.locked()) { c.on('open', () => c.close()); return; }
      conns.push(c);
      c.on('open', () => h.players && h.players(count()));
      c.on('data', d => {
        for (const o of conns) if (o !== c && o.open) o.send(d);   // reenviar a los demás
        h.data && h.data(d);
      });
      const gone = () => {
        const i = conns.indexOf(c);
        if (i >= 0) { conns.splice(i, 1); h.left && h.left(count()); }
      };
      c.on('close', gone);
      c.on('error', gone);
    });
    peer.on('error', e => {
      if (e.type === 'unavailable-id') { leave(); host(h); return; }
      h.error && h.error(e);
    });
  }

  function join(room, h) {
    handlers = h; isHost = false; conns = [];
    peer = new Peer();
    peer.on('open', () => {
      const c = peer.connect(PREFIX + room.toUpperCase(), { reliable: true });
      conns = [c];
      c.on('open', () => h.open && h.open());
      c.on('data', d => h.data && h.data(d));
      c.on('close', () => h.close && h.close());
      c.on('error', () => h.close && h.close());
    });
    peer.on('error', e => h.error && h.error(e));
  }

  // Envía a todos (anfitrión) o al anfitrión (invitado, que lo reenvía)
  function send(d) { for (const c of conns) if (c.open) c.send(d); }
  // Solo anfitrión: un mensaje distinto para cada invitado (i = 0, 1, 2)
  function sendEach(fn) { conns.filter(c => c.open).forEach((c, i) => c.send(fn(i))); }

  function leave() {
    for (const c of conns) { try { c.close(); } catch (e) {} }
    try { peer && peer.destroy(); } catch (e) {}
    conns = []; peer = null;
  }

  return { host, join, send, sendEach, leave, count, get isHost() { return isHost; } };
})();
