# Pool Zurich

Pool de bar en pixel art para jugar desde el celular.

**Versión actual:** ver `js/version.js` (también aparece arriba a la derecha del menú).

**Jugar:** https://tomasrojasmurua.github.io/Pool-Zurich/

## Cómo se juega

- **Apuntar:** toca o arrastra el dedo sobre la mesa hacia donde quieres tirar.
- **Tirar:** arrastra hacia abajo la barra de potencia de la derecha y suelta.
- **Bola en mano:** después de una falta, arrastra la bola blanca a donde quieras.
- **Reglas:** bola 8. El primero en meter una bola elige lisas o rayadas. Gana quien mete la 8 después de terminar su grupo.

## Juegos

Se elige en el menú con el botón `< BOLA 8 >`.

- **Bola 8:** lisas contra rayadas. Gana quien mete la 8 después de terminar su grupo.
- **Bola 9:** bolas 1 a 9 en rombo. Siempre hay que tocar primero la bola más baja de la mesa. Gana quien mete la 9 en un tiro válido, aunque sea de rebote o combinación.
- **Bola 10:** igual que la bola 9, pero con 10 bolas en triángulo. Gana quien mete la 10.

## Modos

- **2 jugadores:** uno contra uno en el mismo celular, pasándolo.
- **4 jugadores:** dos contra dos en el mismo celular. Los turnos van alternando entre equipos (A1, B1, A2, B2) y cada equipo juega con lisas o rayadas.
- **Crear sala / Unirse:** online, de 2 o 4 jugadores. Uno crea la sala y comparte el código de 4 letras; cuando están todos, el que creó la sala aprieta Empezar.

## Instalar en el celular

Abre el link en el navegador y elige "Agregar a pantalla de inicio". Queda como una app.

## Tecnología

HTML5 Canvas y JavaScript sin dependencias de compilación. Física propia, multijugador con [PeerJS](https://peerjs.com/) (conexión directa entre celulares). Se publica con GitHub Pages desde la rama `main`.
