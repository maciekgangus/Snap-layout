# Changelog

## [1.1.0] — 2026-04-25

### Added
- Snap to top half (`Super + Alt + ↑`) and bottom half (`Super + Alt + ↓`)
- Snap to four quarters: top-left, top-right, bottom-left, bottom-right (unbound by default)
- Pop animation (scale-in + fade) on all snap actions, 250ms EASE_OUT_QUAD

### Fixed
- GSettings signal handler leak in preferences window (use-after-free on repeated open/close)
- Defensive null guard in linked-resize poll callback
- Actor cleanup on disable now scoped to extension-touched windows only

## [1.0.0] — 2026-04-11

### Added
- Initial release
- Snap to left/right half, 1/3, 2/3
- Maximize and restore
- Move window to adjacent monitor
- Focus adjacent monitor (pointer warp)
- Preferences UI with live shortcut capture (GTK4 + Libadwaita)
- All shortcuts configurable via `gsettings`
- GNOME Shell 45–49 support (Wayland & X11)
- GPL-2.0-or-later license
