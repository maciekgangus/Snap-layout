/**
 * Snap Layout — GNOME Shell Extension
 * Keyboard-driven window snapping: halves, thirds, two-thirds, multi-monitor.
 * Linked resize: resizing a snapped window automatically adjusts its neighbor.
 *
 * Compatible: GNOME Shell 45–49 | Wayland & X11
 * No unsafe-mode required.
 *
 * SPDX-License-Identifier: GPL-2.0-or-later
 */

import { Extension } from 'resource:///org/gnome/shell/extensions/extension.js';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import Clutter from 'gi://Clutter';
import GLib from 'gi://GLib';
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
        this._setupLinkedResize();
    }

    disable() {
        this._unbindKeys();
        this._teardownLinkedResize();
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

    // ── Linked resize ───────────────────────────────────────────────────────
    //
    // When two windows share an edge, resizing one live-adjusts the neighbor.
    //
    // Approach: hook grab-op-begin/end on Meta.Display.
    //   • On grab-begin: determine which edge is being dragged, find the neighbor
    //     that shares that edge, store the pairing.
    //   • During drag: poll every 16 ms (≈60 fps), read the resizing window's
    //     current frame rect, and push the neighbor's opposite edge to match.
    //   • On grab-end: stop polling, do one final sync.
    //
    // This gives real-time linked resize on both X11 and Wayland (where
    // size-changed only fires after the client commits, i.e. on mouse release).

    // GrabOps that involve the horizontal edges we care about
    static _RESIZE_OPS_RIGHT = new Set([
        Meta.GrabOp.RESIZING_E,
        Meta.GrabOp.RESIZING_NE,
        Meta.GrabOp.RESIZING_SE,
    ]);

    static _RESIZE_OPS_LEFT = new Set([
        Meta.GrabOp.RESIZING_W,
        Meta.GrabOp.RESIZING_NW,
        Meta.GrabOp.RESIZING_SW,
    ]);

    _setupLinkedResize() {
        this._activeLink = null; // { neighbor, side, lastEdge }
        this._pollId     = null;

        this._grabBeginId = global.display.connect('grab-op-begin', (_, win, op) => {
            this._onGrabBegin(win, op);
        });
        this._grabEndId = global.display.connect('grab-op-end', () => {
            this._onGrabEnd();
        });
    }

    _onGrabBegin(win, op) {
        if (!win) return;

        const isRight = SnapLayoutExtension._RESIZE_OPS_RIGHT.has(op);
        const isLeft  = SnapLayoutExtension._RESIZE_OPS_LEFT.has(op);
        if (!isRight && !isLeft) return; // not a horizontal resize

        const r = win.get_frame_rect();

        // The edge being dragged and the side of the neighbor that shares it
        const dragEdge    = isRight ? r.x + r.width : r.x;
        const neighborSide = isRight ? 'left' : 'right';

        const neighbor = this._findNeighbor(win, dragEdge, neighborSide);
        if (!neighbor) return;

        this._activeLink = { win, neighbor, neighborSide, lastEdge: dragEdge };

        // Poll every 16 ms for real-time updates
        this._pollId = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 16, () => {
            this._pollResize();
            return GLib.SOURCE_CONTINUE;
        });
    }

    _onGrabEnd() {
        if (this._pollId !== null) {
            GLib.source_remove(this._pollId);
            this._pollId = null;
        }
        // Final sync to land exactly on the released position
        if (this._activeLink)
            this._pollResize();
        this._activeLink = null;
    }

    _pollResize() {
        const { win, neighbor, neighborSide } = this._activeLink;

        const r       = win.get_frame_rect();
        const newEdge = neighborSide === 'left' ? r.x + r.width : r.x;

        if (Math.abs(newEdge - this._activeLink.lastEdge) < 1) return;
        this._activeLink.lastEdge = newEdge;

        const nr = neighbor.get_frame_rect();
        let nx = nr.x, nw = nr.width;

        if (neighborSide === 'left') {
            nx = newEdge;
            nw = (nr.x + nr.width) - newEdge;
        } else {
            nw = newEdge - nr.x;
        }

        if (nw < 80) return;
        neighbor.move_resize_frame(false, nx, nr.y, nw, nr.height);
    }

    /**
     * Find a window on the same monitor whose `side` edge is within SLACK px
     * of `edge`, excluding `excludeWin` itself.
     */
    _findNeighbor(excludeWin, edge, side) {
        const SLACK = 8;
        const mon   = excludeWin.get_monitor();

        for (const win of global.display.list_all_windows()) {
            if (win === excludeWin) continue;
            if (win.get_monitor() !== mon) continue;
            if (win.get_window_type() !== Meta.WindowType.NORMAL) continue;
            // GNOME 49 changed is_minimized() to a property; handle both
            const minimized = typeof win.is_minimized === 'function'
                ? win.is_minimized() : win.is_minimized;
            if (minimized) continue;

            const r       = win.get_frame_rect();
            const winEdge = side === 'left' ? r.x : r.x + r.width;

            if (Math.abs(winEdge - edge) <= SLACK)
                return win;
        }
        return null;
    }

    _teardownLinkedResize() {
        if (this._grabBeginId) {
            global.display.disconnect(this._grabBeginId);
            this._grabBeginId = null;
        }
        if (this._grabEndId) {
            global.display.disconnect(this._grabEndId);
            this._grabEndId = null;
        }
        if (this._pollId !== null) {
            GLib.source_remove(this._pollId);
            this._pollId = null;
        }
        this._activeLink = null;
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
