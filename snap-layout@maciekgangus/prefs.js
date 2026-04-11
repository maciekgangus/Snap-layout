/**
 * Snap Layout — Preferences
 * GTK4 + Libadwaita UI for configuring keybindings.
 *
 * SPDX-License-Identifier: GPL-2.0-or-later
 */

import { ExtensionPreferences } from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';
import Adw from 'gi://Adw';
import Gtk from 'gi://Gtk';
import Gdk from 'gi://Gdk';
import Gio from 'gi://Gio';
import GObject from 'gi://GObject';

// ── ShortcutRow widget ───────────────────────────────────────────────────────
//
// An Adw.ActionRow with a Gtk.ShortcutLabel on the right.
// Clicking opens a capture dialog so the user can set a new shortcut.

const ShortcutRow = GObject.registerClass(
class ShortcutRow extends Adw.ActionRow {
    _init(settings, key, title, subtitle = '') {
        super._init({ title, subtitle, activatable: true });

        this._settings = settings;
        this._key      = key;

        // ShortcutLabel shows the current binding
        this._label = new Gtk.ShortcutLabel({
            disabled_text:   'Disabled',
            valign:          Gtk.Align.CENTER,
        });
        this._syncLabel();
        this.add_suffix(this._label);

        // Watch settings changes (e.g. reset from terminal)
        this._changedId = settings.connect(`changed::${key}`, () => this._syncLabel());

        // Click row → open capture dialog
        this.connect('activated', () => this._capture());
    }

    _syncLabel() {
        const val = this._settings.get_strv(this._key);
        this._label.set_accelerator(val[0] ?? '');
    }

    _capture() {
        const dialog = new ShortcutCaptureDialog(this._settings, this._key);
        dialog.set_transient_for(this.get_root());
        dialog.present();
    }
});

// ── ShortcutCaptureDialog ────────────────────────────────────────────────────

const ShortcutCaptureDialog = GObject.registerClass(
class ShortcutCaptureDialog extends Adw.Window {
    _init(settings, key) {
        super._init({
            modal:          true,
            title:          'Set Shortcut',
            default_width:  400,
            default_height: 200,
        });

        this._settings = settings;
        this._key      = key;

        const box = new Gtk.Box({
            orientation: Gtk.Orientation.VERTICAL,
            spacing:     12,
            margin_top:  24,
            margin_bottom: 24,
            margin_start: 24,
            margin_end:  24,
        });

        const header = new Adw.HeaderBar({ show_end_title_buttons: false });
        const cancel = new Gtk.Button({ label: 'Cancel' });
        cancel.connect('clicked', () => this.close());
        header.pack_start(cancel);

        const label = new Gtk.Label({
            label:  'Press the key combination you want to use.\nPress Escape to cancel, Backspace to disable.',
            wrap:   true,
            justify: Gtk.Justification.CENTER,
        });

        const hint = new Gtk.Label({
            label:  '…',
            css_classes: ['dim-label'],
        });

        box.append(label);
        box.append(hint);
        this._hint = hint;

        const content = new Gtk.Box({ orientation: Gtk.Orientation.VERTICAL });
        content.append(header);
        content.append(box);
        this.set_content(content);

        // Key capture via Gtk.EventControllerKey.
        // CAPTURE phase: intercept events on the way down to child widgets so
        // nothing (header bar, focused button, GTK internals) swallows them first.
        const ctrl = new Gtk.EventControllerKey();
        ctrl.set_propagation_phase(Gtk.PropagationPhase.CAPTURE);
        ctrl.connect('key-pressed', (_ctrl, keyval, keycode, state) => {
            return this._onKey(keyval, keycode, state);
        });
        this.add_controller(ctrl);
    }

    _onKey(keyval, _keycode, state) {
        // Escape → cancel
        if (keyval === Gdk.KEY_Escape) {
            this.close();
            return Gdk.EVENT_STOP;
        }

        // Backspace → disable shortcut
        if (keyval === Gdk.KEY_BackSpace) {
            this._settings.set_strv(this._key, []);
            this.close();
            return Gdk.EVENT_STOP;
        }

        // Ignore bare modifiers
        const modifiers = [
            Gdk.KEY_Shift_L, Gdk.KEY_Shift_R,
            Gdk.KEY_Control_L, Gdk.KEY_Control_R,
            Gdk.KEY_Alt_L, Gdk.KEY_Alt_R,
            Gdk.KEY_Meta_L, Gdk.KEY_Meta_R,
            Gdk.KEY_Super_L, Gdk.KEY_Super_R,
        ];
        if (modifiers.includes(keyval))
            return Gdk.EVENT_STOP;

        // Build accelerator string
        const mask = state & Gtk.accelerator_get_default_mod_mask();
        const accel = Gtk.accelerator_name(keyval, mask);

        if (!accel || accel === '') return Gdk.EVENT_STOP;

        this._hint.set_label(accel);
        this._settings.set_strv(this._key, [accel]);
        this.close();
        return Gdk.EVENT_STOP;
    }
});

// ── Preferences main class ───────────────────────────────────────────────────

export default class SnapLayoutPreferences extends ExtensionPreferences {
    fillPreferencesWindow(window) {
        const settings = this.getSettings();

        window.set_default_size(600, 700);
        window.set_search_enabled(true);

        // ── Page ────────────────────────────────────────────────────────────
        const page = new Adw.PreferencesPage({
            title: 'Snap Layout',
            icon_name: 'view-grid-symbolic',
        });
        window.add(page);

        // ── Groups ──────────────────────────────────────────────────────────
        const groups = [
            {
                title: 'Snap — Halves',
                rows: [
                    ['snap-left-half',  'Left half',  'Super + ←'],
                    ['snap-right-half', 'Right half', 'Super + →'],
                    ['snap-maximize',   'Maximize',   'Super + ↑'],
                    ['snap-restore',    'Restore',    'Super + ↓'],
                ],
            },
            {
                title: 'Snap — Thirds',
                rows: [
                    ['snap-left-third',       'Left 1/3',  'Super + Alt + ←'],
                    ['snap-right-third',      'Right 1/3', 'Super + Alt + →'],
                    ['snap-left-two-thirds',  'Left 2/3',  'Super + Ctrl + ←'],
                    ['snap-right-two-thirds', 'Right 2/3', 'Super + Ctrl + →'],
                ],
            },
            {
                title: 'Multi-Monitor',
                rows: [
                    ['move-monitor-left',   'Move window → left monitor',  'Super + Shift + ←'],
                    ['move-monitor-right',  'Move window → right monitor', 'Super + Shift + →'],
                    ['focus-monitor-left',  'Focus left monitor',          'Super + Shift + Alt + ←'],
                    ['focus-monitor-right', 'Focus right monitor',         'Super + Shift + Alt + →'],
                ],
            },
        ];

        for (const { title, rows } of groups) {
            const group = new Adw.PreferencesGroup({ title });
            page.add(group);

            for (const [key, label, hint] of rows) {
                group.add(new ShortcutRow(settings, key, label, `Default: ${hint}`));
            }
        }

        // ── Reset button ─────────────────────────────────────────────────────
        const resetGroup = new Adw.PreferencesGroup();
        page.add(resetGroup);

        const resetRow = new Adw.ActionRow({
            title:    'Reset all shortcuts to defaults',
            subtitle: 'Cannot be undone',
        });
        const resetBtn = new Gtk.Button({
            label:       'Reset',
            valign:      Gtk.Align.CENTER,
            css_classes: ['destructive-action'],
        });
        resetBtn.connect('clicked', () => {
            settings.reset('snap-left-half');
            settings.reset('snap-right-half');
            settings.reset('snap-maximize');
            settings.reset('snap-restore');
            settings.reset('snap-left-third');
            settings.reset('snap-right-third');
            settings.reset('snap-left-two-thirds');
            settings.reset('snap-right-two-thirds');
            settings.reset('move-monitor-left');
            settings.reset('move-monitor-right');
            settings.reset('focus-monitor-left');
            settings.reset('focus-monitor-right');
        });
        resetRow.add_suffix(resetBtn);
        resetGroup.add(resetRow);
    }
}
