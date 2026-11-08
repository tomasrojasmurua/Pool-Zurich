// Guarda el juego en el celular para que abra rápido y sin conexión
importScripts('js/version.js');
const CACHE = 'pool-zurich-' + VERSION;
const FILES = [
  './',
  'index.html',
  'manifest.webmanifest',
  'js/physics.js',
  'js/rules.js',
  'js/net.js',
  'js/game.js',
  'js/version.js',
  'js/vendor/peerjs.min.js',
  'assets/bolas-10.png',
  'assets/bolas-32.png',
  'assets/fondo-bar.png',
  'assets/inicio.png',
  'assets/logo.png',
  'assets/mesa.png',
  'assets/ui/barra-potencia.png',
  'assets/ui/boton-desactivado.png',
  'assets/ui/boton-normal.png',
  'assets/ui/boton-presionado.png',
  'assets/ui/ficha-turno.png',
  'assets/ui/icono-ajustes.png',
  'assets/ui/icono-chat.png',
  'assets/ui/icono-inicio.png',
  'assets/ui/icono-monedas.png',
  'assets/ui/icono-pausa.png',
  'assets/ui/icono-reloj.png',
  'assets/ui/icono-silencio.png',
  'assets/ui/icono-sonido.png',
  'assets/ui/icono-trofeo.png',
  'assets/ui/pizarra.png',
  'assets/ui/tiza.png',
  'assets/ui/triangulo.png',
  'assets/personajes/avatar-campeona.png',
  'assets/personajes/avatar-dueno.png',
  'assets/personajes/avatar-novata.png',
  'assets/personajes/avatar-tiburon.png',
  'assets/personajes/campeona.png',
  'assets/personajes/dueno.png',
  'assets/personajes/novata.png',
  'assets/personajes/tiburon.png',
  'assets/tacos/taco-clasico.png',
  'assets/tacos/taco-llamas.png',
  'assets/tacos/taco-negro.png',
  'assets/icons/icon-192.png',
  'assets/icons/icon-512.png'
];
self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (url.origin !== location.origin) return;
  // Primero la red (para recibir actualizaciones), si no hay conexión usa la copia guardada
  e.respondWith(fetch(e.request).then(r => {
    const copy = r.clone();
    caches.open(CACHE).then(c => c.put(e.request, copy));
    return r;
  }).catch(() => caches.match(e.request)));
});
