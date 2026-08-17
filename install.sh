#!/usr/bin/env bash
# install.sh — build limpio + instalación local de SpriteNote para Linux/Arch.
# No requiere sudo para instalar la app. Tus datos de usuario no se tocan.

set -euo pipefail

ROOT="$(cd "$(dirname "$(readlink -f "$0")")" && pwd)"
PREFIX="${HOME}/.local"
XDG_DATA_HOME_REAL="${XDG_DATA_HOME:-${PREFIX}/share}"
APP_HOME="${XDG_DATA_HOME_REAL}/spritenote"
BIN_DIR="${PREFIX}/bin"
DESKTOP_DIR="${XDG_DATA_HOME_REAL}/applications"
ICON_BASE="${XDG_DATA_HOME_REAL}/icons/hicolor"
ICON_DIR="${ICON_BASE}/512x512/apps"
APPIMAGE_DEST="${APP_HOME}/SpriteNote.AppImage"
DESKTOP_FILE="${DESKTOP_DIR}/com.spritenote.app.desktop"
LEGACY_DESKTOP_FILE="${DESKTOP_DIR}/spritenote.desktop"

find_appimage() {
  find "${ROOT}/dist" -maxdepth 1 -type f -name 'SpriteNote-*.AppImage' -print 2>/dev/null \
    | sort -V | tail -n 1
}

usage() {
  cat <<'TXT'
Uso:
  ./install.sh                 # build limpio + instala
  ./install.sh --use-existing  # instala el AppImage existente en dist/
  ./install.sh /ruta/app.AppImage
TXT
}

ensure_user_bin_path() {
  case ":${PATH}:" in
    *":${BIN_DIR}:"*) return 0 ;;
  esac

  local shell_name="${SHELL##*/}"
  local marker="# SpriteNote / user-local binaries"
  local export_line='export PATH="$HOME/.local/bin:$PATH"'

  case "${shell_name}" in
    fish)
      local conf_dir="${XDG_CONFIG_HOME:-$HOME/.config}/fish/conf.d"
      local conf_file="${conf_dir}/spritenote-path.fish"
      mkdir -p "${conf_dir}"
      if [[ ! -f "${conf_file}" ]] || ! grep -Fq '$HOME/.local/bin' "${conf_file}"; then
        cat > "${conf_file}" <<'FISH'
# SpriteNote / user-local binaries
fish_add_path --path "$HOME/.local/bin"
FISH
      fi
      ;;
    zsh)
      local rc="${ZDOTDIR:-$HOME}/.zshrc"
      touch "${rc}"
      if ! grep -Fq '.local/bin' "${rc}"; then
        printf '\n%s\n%s\n' "${marker}" "${export_line}" >> "${rc}"
      fi
      ;;
    bash)
      local rc="$HOME/.bashrc"
      touch "${rc}"
      if ! grep -Fq '.local/bin' "${rc}"; then
        printf '\n%s\n%s\n' "${marker}" "${export_line}" >> "${rc}"
      fi
      ;;
    *)
      local rc="$HOME/.profile"
      touch "${rc}"
      if ! grep -Fq '.local/bin' "${rc}"; then
        printf '\n%s\n%s\n' "${marker}" "${export_line}" >> "${rc}"
      fi
      ;;
  esac

  PATH_WAS_UPDATED=1
}

MODE="${1:-}"
APPIMAGE=""
PATH_WAS_UPDATED=0

case "${MODE}" in
  -h|--help)
    usage
    exit 0
    ;;
  --use-existing)
    APPIMAGE="$(find_appimage || true)"
    [[ -n "${APPIMAGE}" ]] || {
      echo "No hay un AppImage en dist/. Ejecuta ./install.sh para compilar uno limpio." >&2
      exit 1
    }
    ;;
  "")
    command -v npm >/dev/null 2>&1 || {
      echo "Falta npm. En Arch: sudo pacman -S --needed nodejs npm" >&2
      exit 1
    }
    cd "${ROOT}"

    if [[ -f package-lock.json ]] && grep -q "packages.applied-caas-gateway" package-lock.json 2>/dev/null; then
      echo "El package-lock.json apunta a un registry interno inválido." >&2
      exit 1
    fi

    echo ">> Limpiando builds anteriores..."
    rm -rf "${ROOT}/dist"

    echo ">> Instalando/resolviendo dependencias..."
    # El ZIP 1.8.11 no fija un lockfile viejo: npm resuelve las revisiones compatibles
    # actuales desde registry.npmjs.org y crea package-lock.json localmente.
    npm install --no-fund

    echo ">> Aplicando parches de seguridad compatibles (sin --force)..."
    if ! npm audit fix --no-fund; then
      echo "WARN: npm audit fix no pudo resolver todo automáticamente o el registry no respondió." >&2
      echo "      El build continuará; revisa luego con: npm audit" >&2
    fi

    echo ">> Ejecutando pruebas de integración..."
    npm test

    echo ">> Compilando SpriteNote para Linux..."
    npm run dist:linux
    APPIMAGE="$(find_appimage || true)"
    ;;
  *)
    APPIMAGE="$(readlink -f "${MODE}")"
    [[ -f "${APPIMAGE}" ]] || { echo "No existe: ${APPIMAGE}" >&2; exit 1; }
    ;;
esac

[[ -n "${APPIMAGE}" && -s "${APPIMAGE}" ]] || {
  echo "No se pudo generar un AppImage válido." >&2
  exit 1
}

chmod +x "${APPIMAGE}"
mkdir -p "${APP_HOME}" "${BIN_DIR}" "${DESKTOP_DIR}" "${ICON_DIR}"
install -m 755 "${APPIMAGE}" "${APPIMAGE_DEST}"
install -m 644 "${ROOT}/build/icon.png" "${ICON_DIR}/spritenote.png"
ln -sfn "${APPIMAGE_DEST}" "${BIN_DIR}/spritenote"

# Quita la entrada antigua para evitar duplicados/caché fantasma en launchers.
rm -f "${LEGACY_DESKTOP_FILE}"
cat > "${DESKTOP_FILE}" <<EOF_DESKTOP
[Desktop Entry]
Version=1.0
Type=Application
Name=SpriteNote
GenericName=Notes Companion
Comment=Notas, tareas, recordatorios e IA con estética terminal
Exec=${APPIMAGE_DEST}
TryExec=${APPIMAGE_DEST}
Icon=spritenote
Terminal=false
Categories=Utility;Office;
Keywords=notes;tasks;terminal;spritenote;ai;
StartupNotify=true
StartupWMClass=SpriteNote
NoDisplay=false
EOF_DESKTOP
chmod 644 "${DESKTOP_FILE}"

if command -v desktop-file-validate >/dev/null 2>&1; then
  desktop-file-validate "${DESKTOP_FILE}" || {
    echo "WARN: desktop-file-validate encontró un problema en ${DESKTOP_FILE}" >&2
  }
fi
if command -v update-desktop-database >/dev/null 2>&1; then
  update-desktop-database "${DESKTOP_DIR}" >/dev/null 2>&1 || true
fi

# Hyprlauncher es un daemon: si estaba abierto, conserva su inventario anterior.
# Lo cerramos para que el siguiente SUPER+R arranque un daemon limpio y relea .desktop.
if command -v hyprlauncher >/dev/null 2>&1 && pgrep -x hyprlauncher >/dev/null 2>&1; then
  pkill -x hyprlauncher || true
  echo ">> Caché/daemon de hyprlauncher invalidado; se recreará al abrirlo de nuevo."
fi

ensure_user_bin_path

echo ">> SpriteNote instalado correctamente."
echo "   App:      ${APPIMAGE_DEST}"
echo "   Comando:  ${BIN_DIR}/spritenote"
echo "   Launcher: ${DESKTOP_FILE}"
echo
if [[ "${PATH_WAS_UPDATED}" == "1" ]]; then
  echo "IMPORTANTE: ~/.local/bin no estaba en el PATH de esta terminal."
  echo "El instalador ya lo agregó a la configuración de tu shell."
  echo "Abre una terminal nueva (o recarga tu shell) y ya podrás usar: spritenote"
  echo "Para ESTA terminal, puedes usar ahora: export PATH=\"$HOME/.local/bin:\$PATH\""
  echo
fi
echo "Visualizador en Arch: sudo pacman -S --needed libpulse"
