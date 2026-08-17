
## Spritenote 
Port pensado para Arch Linux y sesiones Wayland/Hyprland.
Incluye notas, tareas, recordatorios, hábitos, calendario, IA Gemini/Groq,
personajes, notificaciones nativas, tray, ejecución en segundo plano y
visualizador del audio del sistema.


## Disclaimers importantes:

## (Legal Notice) Characters used in the application:
SpriteNote is an independent, fan-made project and is not affiliated with, endorsed by, sponsored by, or officially associated with any of the creators, publishers, studios, or companies related to the characters featured in the application.
Any third-party characters, names, artwork, trademarks, and other related intellectual property shown or referenced within SpriteNote belong to their respective owners and original creators.
These characters and assets are included for demonstration, personalization, and non-commercial fan-use purposes only. No ownership over third-party intellectual property is claimed.
SpriteNote itself, including its original source code and original assets, is distributed under the license specified in this repository.

Credits:
Claw'd - "Claude" official mascot, by Anthropic. https://www.anthropic.com/
Femme Soule - Videogame character from PUKEY GODDESS SHOT TRICK. https://store.steampowered.com/app/4150720/PUKEY_GODDESS_SHOT_TRICK/

## Lo mismo pero en español
SpriteNote es un proyecto independiente creado por fans y no está afiliado, respaldado, patrocinado ni asociado oficialmente con ninguno de los creadores, editores, estudios o empresas relacionados con los personajes mostrados en la aplicación.
Todos los personajes, nombres, ilustraciones, marcas registradas y demás propiedad intelectual de terceros mostrados o mencionados dentro de SpriteNote pertenecen a sus respectivos propietarios y creadores originales.
Estos personajes y recursos se incluyen únicamente con fines de demostración, personalización y uso no comercial por parte de fans. SpriteNote no reclama ningún tipo de propiedad sobre la propiedad intelectual de terceros.
SpriteNote como proyecto, incluyendo su código fuente original y sus recursos originales, se distribuye bajo la licencia especificada en este repositorio.

Creditos:
Claw'd - Mascota Oficial de Claude, de Anthropic. https://www.anthropic.com/
Femme Soule - Personaje del juego: PUKEY GODDESS SHOT TRICK. https://store.steampowered.com/app/4150720/PUKEY_GODDESS_SHOT_TRICK/

## Instalar en Arch 

```bash
sudo pacman -S --needed nodejs npm libpulse fuse2 desktop-file-utils
git clone https://github.com/Cudex29/Spritenote-Linux.git
cd Spritenote-Linux
chmod +x install.sh uninstall.sh
./install.sh
```

## Reinicia tu terminal para que los cambios en $PATH tengan efecto.

## Instalacion explicada
1. Instalar dependencias

Primero asegúrate de tener instalados Git, Node.js, npm, soporte FUSE para AppImage y las herramientas de PulseAudio necesarias para el visualizador de audio:

sudo pacman -S --needed git nodejs npm libpulse fuse2

libpulse proporciona herramientas como pactl y parec, utilizadas por SpriteNote para capturar el audio del sistema en Linux. fuse2 permite ejecutar correctamente aplicaciones distribuidas como AppImage en Arch Linux.

2. Clonar el repositorio
git clone https://github.com/Cudex29/Spritenote-Linux.git

Entra en la carpeta del proyecto:

cd Spritenote-Linux
3. Dar permisos al instalador
chmod +x install.sh uninstall.sh
4. Instalar SpriteNote

Ejecuta:

./install.sh

El instalador se encargará de:

Instalar las dependencias npm.
Aplicar actualizaciones de seguridad compatibles.
Ejecutar las pruebas del proyecto.
Compilar SpriteNote para Linux.
Generar el AppImage.
Instalar SpriteNote en tu directorio de usuario.
Crear el comando spritenote.
Crear la entrada .desktop para launchers de aplicaciones.

La compilación de Electron puede tardar algunos minutos. No cierres la terminal mientras esté trabajando.

5. Reiniciar la terminal

Si es la primera vez que instalas SpriteNote, cierra y vuelve a abrir la terminal para que cualquier cambio realizado en $PATH sea cargado correctamente.

Después puedes iniciar SpriteNote simplemente con:

spritenote

También debería aparecer como:

SpriteNote

en launchers compatibles con archivos .desktop, como Hyprlauncher.


`install.sh` hace un **build limpio por defecto**: elimina `dist/`, ejecuta
`npm install`, aplica parches compatibles con `npm audit fix` (sin `--force`), ejecuta tests, compila AppImage + tar.xz y después instala el AppImage respetando
`XDG_DATA_HOME` (o `~/.local/share` si no está definido).
Por defecto crea:

```text
~/.local/share/spritenote/SpriteNote.AppImage
~/.local/bin/spritenote
~/.local/share/applications/com.spritenote.app.desktop
```

Si `~/.local/bin` no estaba en tu `PATH`, el instalador lo registra de forma
persistente para bash, zsh o fish. El proceso hijo no puede modificar el PATH
de la terminal que ya estaba abierta, así que basta abrir una terminal nueva.

Si Hyprlauncher ya estaba ejecutándose, el instalador cierra su daemon para que
el siguiente lanzamiento vuelva a leer las entradas `.desktop`.

Después puedes abrir SpriteNote desde el launcher o con:

```bash
spritenote
```

### Reinstalar sin arrastrar un build roto

```bash
./install.sh
```

El instalador no reutiliza automáticamente un AppImage incompleto en `dist/`.
Sólo usa uno existente si lo pides:

```bash
./install.sh --use-existing
```

O instala uno concreto:

```bash
./install.sh /ruta/SpriteNote-1.8.11-x86_64.AppImage
```

## Desarrollo

```bash
npm install
npm audit fix
npm test
npm run start:linux
```

Build Linux:

```bash
npm run dist:arch
```

Los artefactos aparecen en `dist/` como AppImage y `tar.xz`.

## Visualizador de audio en Linux

SpriteNote usa `parec` y `pactl` de `libpulse` para escuchar el monitor del
sink de salida predeterminado. Funciona con PulseAudio y PipeWire mediante
`pipewire-pulse`.

```bash
pactl get-default-sink
pactl list short sources
```

Debe existir una fuente `.monitor`. Si falta `parec`:

```bash
sudo pacman -S --needed libpulse
```

El backend Linux usa una ventana FFT de 1024 muestras, captura de baja latencia
y entrega frames aproximadamente a 60 Hz. El renderer usa ataque rápido y
caída configurable para que golpes y bajos reaccionen sin sensación de 30 FPS.
El audio no se guarda en disco.

### Modos del visualizador

En `SPRITENOTE.CFG > VISUALIZADOR` puedes elegir:

- **Distribución:** `ESCALA`, `BAJOS CENTRO` o `BAJOS ORILLAS`.
- **Estilo:** `ESPECTRO`, `DIGITAL` segmentado o `ANÁLOGO` tipo VU meter.
- Líneas, sensibilidad, separación y suavizado siguen siendo configurables.

El modo `ANÁLOGO` mide el nivel global, por lo que la distribución de
frecuencias queda temporalmente desactivada mientras ese estilo está activo.

### Modo reloj / compacto

En 1.8.11 el modo compacto deja de anclar la interfaz al borde inferior. Sprite, reloj, prompt y statusbar forman una sola “zona segura” centrada verticalmente dentro del tile, de modo que Hyprland puede cambiar los bounds de la ventana sin empujar los controles fuera del viewport. El visualizador permanece como fondo y el bloque principal escala según la altura disponible.

El bloque de personaje + reloj + prompt descansa ahora en la zona inferior para
dejar más aire visual en la parte superior. El visualizador ambiental tiene un
poco más de presencia y refleja el mismo estilo elegido para el panel principal.
Al abrir el chat se atenúa para mantener la lectura cómoda.

En la statusbar aparece `≋ AUDIO`; al activarlo cambia a `LIVE` y controla el
mismo stream del panel `SYSTEM MONITOR`, sin abrir una segunda captura.

## Segundo plano

Con segundo plano activado, cerrar la ventana la oculta en el tray y mantiene
el scheduler de recordatorios. El autoarranque se registra en:

```text
~/.config/autostart/spritenote.desktop
```

Desinstalar no borra notas ni configuración:

```bash
./uninstall.sh
```

## npm 12

El ZIP no arrastra un lockfile viejo: en la primera instalación npm resuelve desde
`https://registry.npmjs.org/`, genera un `package-lock.json` local y conserva la
protección contra paquetes remotos arbitrarios. El instalador ejecuta `npm audit fix`
sin `--force`; el script de `electron-winstaller` queda denegado porque sólo pertenece
al empaquetado Windows.

## Estructura

```text
SpriteNote/
├── build/       icono Linux
├── electron/    main, preload, storage, scheduler y loopback Linux
├── shared/      lógica compartida
├── src/         interfaz, estilos, scripts y personajes
├── tests/       pruebas unitarias e integración del port
├── install.sh
├── uninstall.sh
├── package.json
└── README.md
```


## Seguridad del toolchain

- Electron fijado en `42.9.1`.
- electron-builder fijado en `26.15.7`.
- El instalador usa el registry oficial y aplica `npm audit fix` **sin `--force`** antes del build.
- El ZIP no incluye un `package-lock.json` viejo: se genera localmente durante la instalación para no fijar revisiones transitivas vulnerables que ya tengan parche compatible.
- La suite de integración acepta ese `package-lock.json` generado localmente y verifica su contenido, en vez de confundirlo con un lockfile viejo del ZIP.
