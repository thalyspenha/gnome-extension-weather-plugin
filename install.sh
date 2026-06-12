#!/usr/bin/env bash
set -e
UUID="weather-plugin@thalysvalisi"
DEST="$HOME/.local/share/gnome-shell/extensions/$UUID"

mkdir -p "$DEST"
rsync -a --exclude='.git' --exclude='node_modules' --exclude='docs' --exclude='tests' --exclude='.claude' . "$DEST"

glib-compile-schemas "$DEST/schemas/"

echo "Instalado em $DEST"
echo "Execute: gnome-extensions enable $UUID"
echo "Reinicie o GNOME Shell: Alt+F2 → r → Enter (X11) ou logout/login (Wayland)"
