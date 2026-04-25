# Changelog

## [1.3.0] — 2026-04-25

### Added
- Layout save/restore — 3 slots per monitor, independently keyed by monitor geometry
- `Super+Ctrl+Shift+1/2/3` saves current window arrangement on active monitor
- `Super+Ctrl+1/2/3` restores — proximity-matches open windows to saved positions and animates each one
- OSD notification (GNOME volume-style flash) on save and restore
- Slots are empty by default; attempting to restore an empty slot shows "Slot N is empty"
- All 6 shortcuts configurable in preferences under new Layouts groups

## [1.2.0] — 2026-04-25

### Added
- Cycle snapping (beta): Super+← / Super+→ cycle through half → third → two-thirds on repeated presses
  - Off by default; toggle in Preferences → Experimental
  - Cycle history is per-window and per-monitor; direct shortcut presses update history too

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
