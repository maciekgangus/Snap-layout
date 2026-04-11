#!/usr/bin/env bash
# Snap Layout — install script
# Usage: ./install.sh
set -euo pipefail

UUID="snap-layout@maciekgangus"
SRC="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/$UUID"
DST="$HOME/.local/share/gnome-shell/extensions/$UUID"

echo "Installing $UUID …"
mkdir -p "$DST/schemas"

cp "$SRC/metadata.json"  "$DST/"
cp "$SRC/extension.js"   "$DST/"
cp "$SRC/prefs.js"       "$DST/"
cp "$SRC/stylesheet.css" "$DST/"
cp "$SRC/schemas/"*.xml  "$DST/schemas/"

echo "Compiling GSettings schemas …"
glib-compile-schemas "$DST/schemas/"

echo ""
echo "Done. Next steps:"
echo "  1. Log out and log back in  (Wayland requires a full session restart)"
echo "     gnome-session-quit --logout --no-prompt"
echo "  2. gnome-extensions enable $UUID"
echo "  3. gnome-extensions prefs  $UUID   # to open the preferences GUI"
echo ""
echo "To change a shortcut from the terminal:"
echo "  gsettings set org.gnome.shell.extensions.snap-layout snap-left-third \"['<Super>u']\""
