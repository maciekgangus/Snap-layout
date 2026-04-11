/**
 * Snap Layout — GNOME Shell Extension
 * Keyboard-driven window snapping: halves, thirds, two-thirds, multi-monitor.
 *
 * Compatible: GNOME Shell 45–49 | Wayland & X11
 * No unsafe-mode required.
 *
 * SPDX-License-Identifier: GPL-2.0-or-later
 */

import { Extension } from 'resource:///org/gnome/shell/extensions/extension.js';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import Clutter from 'gi://Clutter';
import Meta from 'gi://Meta';
import Shell from 'gi://Shell';

// Feature-detect the maximize API change in GNOME 49.
// GNOME 45–48: maximize(Meta.MaximizeFlags.BOTH) / unmaximize(Meta.MaximizeFlags.BOTH)
// GNOME 49+:   maximize() / unmaximize() — no flags argument; set_maximize_flags() added.
const _maximizeNeedsFlags = !('set_maximize_flags' in Meta.Window.prototype);

function _maximize(win) {
    _maximizeNeedsFlags
        ? win.maximize(Meta.MaximizeFlags.BOTH)
        : win.maximize();
}

function _unmaximize(win) {
    _maximizeNeedsFlags
        ? win.unmaximize(Meta.MaximizeFlags.BOTH)
        : win.unmaximize();
}

export default class SnapLayoutExtension extends Extension {
    enable() {
        this._settings = this.getSettings();
        this._keybindings = [];
        this._bindKeys();
    }

    disable() {
        this._unbindKeys();
        this._settings = null;
    }

    // ── Window helpers ──────────────────────────────────────────────────────

    _win() {
        return global.display.focus_window ?? null;
    }

    /**
     * Snap focused window to a fraction of its current monitor's work area.
     * @param {number} xFrac  — left edge as fraction of work area width  (0–1)
     * @param {number} yFrac  — top  edge as fraction of work area height (0–1)
     * @param {number} wFrac  — width  as fraction of work area width     (0–1)
     * @param {number} hFrac  — height as fraction of work area height    (0–1)
     */
    _snap(xFrac, yFrac, wFrac, hFrac) {
        const win = this._win();
        if (!win) return;

        // Un-maximize before resizing — move_resize_frame is ignored on a
        // maximized window. Both calls are synchronous compositor ops and
        // can be issued back-to-back safely.
        if (win.is_maximized())
            _unmaximize(win);

        const wa = win.get_work_area_current_monitor();
        win.move_resize_frame(
            false,                               // user_op=false → programmatic, no interactive constraints
            wa.x + Math.round(wa.width  * xFrac),
            wa.y + Math.round(wa.height * yFrac),
            Math.round(wa.width  * wFrac),
            Math.round(wa.height * hFrac),
        );
    }

    // ── Snap actions ────────────────────────────────────────────────────────

    _snapLeftHalf()       { this._snap(0,   0, 1 / 2, 1); }
    _snapRightHalf()      { this._snap(1/2, 0, 1 / 2, 1); }
    _snapLeftThird()      { this._snap(0,   0, 1 / 3, 1); }
    _snapRightThird()     { this._snap(2/3, 0, 1 / 3, 1); }
    _snapLeftTwoThirds()  { this._snap(0,   0, 2 / 3, 1); }
    _snapRightTwoThirds() { this._snap(1/3, 0, 2 / 3, 1); }

    _snapMaximize() {
        const win = this._win();
        if (!win) return;
        _maximize(win);
    }

    _snapRestore() {
        const win = this._win();
        if (!win) return;
        if (win.is_maximized()) {
            _unmaximize(win);
        } else {
            // Not maximized → snap to a comfortable centred size
            this._snap(0.2, 0.1, 0.6, 0.8);
        }
    }

    // ── Monitor actions ─────────────────────────────────────────────────────

    /**
     * Move focused window to the geometrically adjacent monitor.
     * Uses get_monitor_neighbor_index — correct for any physical arrangement,
     * unlike index arithmetic which assumes left-to-right ordering.
     * @param {'left'|'right'} dir
     */
    _moveToMonitor(dir) {
        const win = this._win();
        if (!win) return;

        const direction = dir === 'left'
            ? Meta.DisplayDirection.LEFT
            : Meta.DisplayDirection.RIGHT;

        const tgt = global.display.get_monitor_neighbor_index(win.get_monitor(), direction);
        if (tgt === -1) return;
        win.move_to_monitor(tgt);
    }

    /**
     * Warp pointer to centre of the geometrically adjacent monitor.
     * get_current_monitor() tracks the pointer position — correct for this use.
     * @param {'left'|'right'} dir
     */
    _focusMonitor(dir) {
        const direction = dir === 'left'
            ? Meta.DisplayDirection.LEFT
            : Meta.DisplayDirection.RIGHT;

        const cur = global.display.get_current_monitor();
        const tgt = global.display.get_monitor_neighbor_index(cur, direction);
        if (tgt === -1) return;

        const geom = global.display.get_monitor_geometry(tgt);
        const cx   = geom.x + Math.round(geom.width  / 2);
        const cy   = geom.y + Math.round(geom.height / 2);

        Clutter.get_default_backend().get_default_seat().warp_pointer(cx, cy);
    }

    // ── Keybinding registration ──────────────────────────────────────────────

    _bindKeys() {
        const mode  = Shell.ActionMode.NORMAL | Shell.ActionMode.OVERVIEW;
        const flags = Meta.KeyBindingFlags.NONE;

        const map = [
            ['snap-left-half',        () => this._snapLeftHalf()],
            ['snap-right-half',       () => this._snapRightHalf()],
            ['snap-maximize',         () => this._snapMaximize()],
            ['snap-restore',          () => this._snapRestore()],
            ['snap-left-third',       () => this._snapLeftThird()],
            ['snap-right-third',      () => this._snapRightThird()],
            ['snap-left-two-thirds',  () => this._snapLeftTwoThirds()],
            ['snap-right-two-thirds', () => this._snapRightTwoThirds()],
            ['move-monitor-left',     () => this._moveToMonitor('left')],
            ['move-monitor-right',    () => this._moveToMonitor('right')],
            ['focus-monitor-left',    () => this._focusMonitor('left')],
            ['focus-monitor-right',   () => this._focusMonitor('right')],
        ];

        for (const [name, handler] of map) {
            Main.wm.addKeybinding(name, this._settings, flags, mode, handler);
            this._keybindings.push(name);
        }
    }

    _unbindKeys() {
        for (const name of this._keybindings)
            Main.wm.removeKeybinding(name);
        this._keybindings = [];
    }
}
