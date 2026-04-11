# Snap Layout

A minimal GNOME Shell extension for keyboard-driven window snapping.

**Halves, thirds, two-thirds — all from the keyboard. No unsafe-mode required.**

Compatible with GNOME Shell 45–49 on Wayland and X11.

---

## Features

- Snap to left/right **half**, **1/3**, **2/3**
- **Maximize** and **restore**
- **Move window** to an adjacent monitor
- **Focus** an adjacent monitor (moves pointer only)
- All shortcuts configurable via the preferences GUI or `gsettings`
- Zero runtime overhead when windows are not being moved

## Default shortcuts

| Action | Default shortcut |
|---|---|
| Left half | `Super + ←` |
| Right half | `Super + →` |
| Maximize | `Super + ↑` |
| Restore | `Super + ↓` |
| Left 1/3 | `Super + Alt + ←` |
| Right 1/3 | `Super + Alt + →` |
| Left 2/3 | `Super + Ctrl + ←` |
| Right 2/3 | `Super + Ctrl + →` |
| Move to left monitor | `Super + Shift + ←` |
| Move to right monitor | `Super + Shift + →` |
| Focus left monitor | `Super + Shift + Alt + ←` |
| Focus right monitor | `Super + Shift + Alt + →` |

## Installation

### From source

```bash
git clone https://github.com/maciek/snap-layout
cd snap-layout
chmod +x install.sh
./install.sh
```

Log out and log back in (Wayland requires a full session restart), then:

```bash
gnome-extensions enable snap-layout@maciek
```

### From extensions.gnome.org

Visit the extension page and click **Install**.

## Changing shortcuts

Open the preferences window:

```bash
gnome-extensions prefs snap-layout@maciek
```

Or use `gsettings` directly:

```bash
# List all current shortcuts
gsettings list-recursively org.gnome.shell.extensions.snap-layout

# Change a shortcut
gsettings set org.gnome.shell.extensions.snap-layout snap-left-third "['<Super>u']"

# Disable a shortcut
gsettings set org.gnome.shell.extensions.snap-layout snap-left-third "[]"

# Reset everything to defaults
gsettings reset-recursively org.gnome.shell.extensions.snap-layout
```

## Uninstalling

```bash
gnome-extensions disable snap-layout@maciek
rm -rf ~/.local/share/gnome-shell/extensions/snap-layout@maciek
```

## Debugging

```bash
# Live logs
journalctl -f /usr/bin/gnome-shell | grep -i "snap\|Error"

# Restart extension without logging out (disable/enable cycle)
gnome-extensions disable snap-layout@maciek
gnome-extensions enable  snap-layout@maciek
```

## Project structure

```
snap-layout@maciek/
├── metadata.json      # UUID, name, compatible GNOME versions
├── extension.js       # Core logic — keybindings and window operations
├── prefs.js           # Preferences UI (GTK4 + Libadwaita)
├── stylesheet.css     # Empty — extension adds no shell UI elements
└── schemas/
    └── org.gnome.shell.extensions.snap-layout.gschema.xml
```

## Why not use unsafe-mode / Shell.Eval?

Since GNOME 41, `org.gnome.Shell.Eval` is disabled for external callers.
Enabling it (`unsafe-mode`) allows any process on your system to execute
arbitrary JavaScript inside the GNOME Shell process — a real security risk.

This extension uses the official Mutter/Shell extension API instead:
`Meta.Window.move_resize_frame()`, `Meta.Window.move_to_monitor()`,
and `Clutter.Seat.warp_pointer()` — all available natively, no hacks needed.

## License

GPL-2.0-or-later — see [LICENSE](LICENSE).
