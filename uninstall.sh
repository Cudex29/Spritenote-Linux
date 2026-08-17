#!/usr/bin/env bash
# uninstall.sh — elimina la aplicación, sin borrar tus notas/configuración.
set -euo pipefail

PREFIX="${HOME}/.local"
XDG_DATA_HOME_REAL="${XDG_DATA_HOME:-${PREFIX}/share}"
DESKTOP_DIR="${XDG_DATA_HOME_REAL}/applications"

rm -f "${PREFIX}/bin/spritenote"
rm -rf "${XDG_DATA_HOME_REAL}/spritenote"
rm -f "${XDG_DATA_HOME_REAL}/icons/hicolor/512x512/apps/spritenote.png"
rm -f "${DESKTOP_DIR}/spritenote.desktop"
rm -f "${DESKTOP_DIR}/com.spritenote.app.desktop"
rm -f "${HOME}/.config/autostart/spritenote.desktop"

command -v update-desktop-database >/dev/null 2>&1 \
  && update-desktop-database "${DESKTOP_DIR}" >/dev/null 2>&1 || true
if command -v hyprlauncher >/dev/null 2>&1 && pgrep -x hyprlauncher >/dev/null 2>&1; then
  pkill -x hyprlauncher || true
fi

echo ">> SpriteNote desinstalado."
echo "Tus datos de Electron NO se borraron."
echo "Si también quieres borrarlos, revisa: ${XDG_CONFIG_HOME:-$HOME/.config}/SpriteNote"
