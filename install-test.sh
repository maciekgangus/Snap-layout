#!/usr/bin/env bash
set -euo pipefail

DEST="$HOME/.local/share/gnome-shell/extensions/snap-layout-test@maciekgangus"
SRC="$(dirname "$0")/snap-layout-test@maciekgangus"

echo "Installing test extension to $DEST …"
rm -rf "$DEST"
mkdir -p "$DEST"
cp -r "$SRC"/. "$DEST/"

glib-compile-schemas "$DEST/schemas/"
echo "Schemas compiled."

echo ""
echo "Done. Now run:"
echo "  gnome-extensions enable snap-layout-test@maciekgangus"
echo "  gnome-extensions prefs snap-layout-test@maciekgangus"
echo ""
echo "To reload after code changes (X11 only):"
echo "  gnome-extensions disable snap-layout-test@maciekgangus && gnome-extensions enable snap-layout-test@maciekgangus"
echo ""
echo "On Wayland: log out and back in after install, then just disable/enable for JS changes."
