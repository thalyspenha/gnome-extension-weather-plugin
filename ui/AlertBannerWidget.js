import St from 'gi://St';
import Clutter from 'gi://Clutter';
import GObject from 'gi://GObject';

const SEVERITY_ORDER = ['Extreme', 'Severe', 'Moderate', 'Minor', 'Unknown'];

const SEVERITY_META = {
    Extreme:  { label: 'EXTREMO', css: 'weather-alert-badge-extreme' },
    Severe:   { label: 'SEVERO',  css: 'weather-alert-badge-severe' },
    Moderate: { label: 'MÉDIO',   css: 'weather-alert-badge-moderate' },
    Minor:    { label: 'BAIXO',   css: 'weather-alert-badge-minor' },
    Unknown:  { label: '—',       css: 'weather-alert-badge-unknown' },
};

function _alertType(title) {
    return title.split('.')[0].trim();
}

function _maxSeverity(severities) {
    for (const s of SEVERITY_ORDER)
        if (severities.includes(s)) return s;
    return 'Unknown';
}

export const AlertBannerWidget = GObject.registerClass(
class AlertBannerWidget extends St.BoxLayout {
    _init() {
        super._init({ vertical: true, styleClass: 'weather-alert-banner' });
        this.hide();
    }

    update(model) {
        this.destroy_all_children();

        if (!model.alerts || model.alerts.length === 0) {
            this.hide();
            return;
        }

        const groups = new Map();
        for (const alert of model.alerts) {
            const type = _alertType(alert.title);
            if (!groups.has(type))
                groups.set(type, { severities: [] });
            groups.get(type).severities.push(alert.severity ?? 'Unknown');
        }

        const totalCount = model.alerts.length;
        let expanded = false;

        const headerBox = new St.BoxLayout({
            styleClass: 'weather-alert-header',
            xExpand:    true,
            yAlign:     Clutter.ActorAlign.CENTER,
        });
        headerBox.add_child(new St.Icon({
            iconName:  'weather-severe-alert-symbolic',
            iconSize:  16,
            yAlign:    Clutter.ActorAlign.CENTER,
        }));
        const headerLabel = new St.Label({
            text:    `  ${totalCount} alerta${totalCount !== 1 ? 's' : ''} ativo${totalCount !== 1 ? 's' : ''}`,
            xExpand: true,
            yAlign:  Clutter.ActorAlign.CENTER,
        });
        const chevron = new St.Label({
            text:   '▾',
            yAlign: Clutter.ActorAlign.CENTER,
        });
        headerBox.add_child(headerLabel);
        headerBox.add_child(chevron);

        const headerBtn = new St.Button({
            child:      headerBox,
            xExpand:    true,
            styleClass: 'weather-alert-header-btn',
        });

        const list = new St.BoxLayout({
            vertical:   true,
            styleClass: 'weather-alert-list',
        });
        list.hide();

        for (const [type, { severities }] of groups) {
            const sev     = _maxSeverity(severities);
            const sevMeta = SEVERITY_META[sev] ?? SEVERITY_META.Unknown;

            const row = new St.BoxLayout({
                xExpand:    true,
                styleClass: 'weather-alert-row',
                yAlign:     Clutter.ActorAlign.CENTER,
            });
            row.add_child(new St.Label({
                text:    type,
                xExpand: true,
                yAlign:  Clutter.ActorAlign.CENTER,
            }));
            row.add_child(new St.Label({
                text:       sevMeta.label,
                styleClass: `weather-alert-badge ${sevMeta.css}`,
                yAlign:     Clutter.ActorAlign.CENTER,
            }));
            list.add_child(row);
        }

        headerBtn.connect('clicked', () => {
            expanded = !expanded;
            chevron.set_text(expanded ? '▴' : '▾');
            expanded ? list.show() : list.hide();
        });

        this.add_child(headerBtn);
        this.add_child(list);
        this.show();
    }
});
