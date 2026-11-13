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

There is no build step, linter, or test suite — verify changes by installing and exercising the extension in a live GNOME session. Per extension there are two JS files:

- **`extension.js`** — `SnapLayoutExtension` class (extends `Extension`). Registers/unregisters all keybindings in `enable()`/`disable()`. The `_snap(xFrac, yFrac, wFrac, hFrac)` method is the single resizing primitive — all snap actions are one-liner wrappers calling it with the appropriate fractions. Monitor actions use `Meta.Window.move_to_monitor()` and `Clutter.Seat.warp_pointer()`.

- **`prefs.js`** — `SnapLayoutPreferences` class (extends `ExtensionPreferences`). GTK4 + Libadwaita UI. `ShortcutRow` is a custom `Adw.ActionRow` that shows the current binding and opens `ShortcutCaptureDialog` on click. The capture dialog uses `Gtk.EventControllerKey` to intercept the key press and writes the accelerator string back to GSettings.

Beyond the snap primitives, `extension.js` also contains three stateful subsystems that span several methods:

- **Cycle snapping** (`_cycleSnap`, `_CYCLE_LEFT/_RIGHT`, `_SNAP_FRACS`): when the `cycle-snapping` setting is on, repeating left/right half cycles half → third → two-thirds. `_snap(..., historyKey)` records the last snap per window in `_snapHistory`; direct third/two-thirds shortcuts also pass a key so cycling continues from the current position.
- **Layout save/restore** (`_saveLayout`/`_restoreLayout`/`_loadLayouts`): 3 slots per monitor, serialized as JSON into the `layouts` GSettings string key (keyed via `_monitorKey`).
- **Linked resize** (`_setupLinkedResize`, `_onGrabBegin/_onGrabEnd`, `_pollResize`, `_findNeighbor`): connects to `grab-op-begin/end` on `global.display`; while a window edge is dragged it polls and resizes the adjacent snapped neighbor. Must be torn down in `_teardownLinkedResize()` on `disable()`.

Snap gap and the center-size percentages come from settings (`snap-gap`, `center-width-pct`, `center-height-pct`).

## Test extension (`snap-layout-test@maciekgangus/`)

A full copy of the extension with its own UUID (`snap-layout-test@maciekgangus`), schema id (`org.gnome.shell.extensions.snap-layout-test`) and schema file, so it can be installed side by side with the real one. It is the sandbox for experimental changes and **must not be submitted to EGO**. It is not kept in sync automatically (e.g. it currently lacks `snap-center`), so port changes manually if needed. Install with `./install-test.sh` (then `gnome-extensions enable snap-layout-test@maciekgangus`); `install.sh` only installs the main extension.

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
