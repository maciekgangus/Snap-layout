# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Snap Layout** (`snap-layout@maciekgangus`) is a GNOME Shell extension providing keyboard-driven window snapping — halves, thirds, two-thirds, and multi-monitor operations. No unsafe-mode required; it uses official Mutter/Shell APIs only.

Targets GNOME Shell 45–49, Wayland and X11.

## Install & Reload

```bash
chmod +x install.sh
./install.sh
```

After first install, log out/in (Wayland). Then:

```bash
gnome-extensions enable snap-layout@maciekgangus
```

Reload without logging out (disable/enable cycle — does not work on Wayland for JS changes):

```bash
gnome-extensions disable snap-layout@maciekgangus && gnome-extensions enable snap-layout@maciekgangus
```

Open preferences GUI:

```bash
gnome-extensions prefs snap-layout@maciekgangus
```

## Debugging

```bash
# Live log stream filtered to this extension
journalctl -f /usr/bin/gnome-shell | grep -i "snap\|Error"
```

## Architecture

There are only two JS files:

- **`extension.js`** — `SnapLayoutExtension` class (extends `Extension`). Registers/unregisters all keybindings in `enable()`/`disable()`. The `_snap(xFrac, yFrac, wFrac, hFrac)` method is the single resizing primitive — all snap actions are one-liner wrappers calling it with the appropriate fractions. Monitor actions use `Meta.Window.move_to_monitor()` and `Clutter.Seat.warp_pointer()`.

- **`prefs.js`** — `SnapLayoutPreferences` class (extends `ExtensionPreferences`). GTK4 + Libadwaita UI. `ShortcutRow` is a custom `Adw.ActionRow` that shows the current binding and opens `ShortcutCaptureDialog` on click. The capture dialog uses `Gtk.EventControllerKey` to intercept the key press and writes the accelerator string back to GSettings.

## GSettings Schema

`org.gnome.shell.extensions.snap-layout.gschema.xml` defines one `as` (string array) key per action. Defaults are the canonical GNOME accelerator strings (e.g. `['<Super>Left']`).

**Any change to this file requires recompiling schemas** (re-running `./install.sh` handles this automatically):

```bash
glib-compile-schemas ~/.local/share/gnome-shell/extensions/snap-layout@maciekgangus/schemas/
```

Adding a new action requires:
1. New key in the `.gschema.xml`
2. New `_snapXxx()` method in `extension.js`
3. New entry in the `map` array inside `_bindKeys()`
4. New `ShortcutRow` entry in the relevant `groups` array in `prefs.js`
5. New `settings.reset('key-name')` call in the Reset button handler in `prefs.js`

## GNOME Shell version compatibility

`win.maximize()` / `win.unmaximize()` no longer accept `Meta.MaximizeFlags` in GNOME 49+. The extension guards this with try/catch to stay compatible with shells 45–48 as well.
