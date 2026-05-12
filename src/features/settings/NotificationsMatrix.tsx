import { Switch } from '../../components/ui/switch';
import { Label } from '../../components/ui/label';
import type { UserPreferences, UserPreferencesUpdate } from '../../services/userPreferences';

interface NotifEvent {
  key: string;
  label: string;
  emailKey: keyof UserPreferences;
  inappKey: keyof UserPreferences;
}

const NOTIF_EVENTS: NotifEvent[] = [
  { key: 'goal_target_reached', label: 'Objetivo atingido', emailKey: 'notif_goal_target_reached_email', inappKey: 'notif_goal_target_reached_inapp' },
  { key: 'goal_deadline_near', label: 'Prazo de objetivo próximo', emailKey: 'notif_goal_deadline_near_email', inappKey: 'notif_goal_deadline_near_inapp' },
  { key: 'budget_80pct', label: 'Orçamento a 80%', emailKey: 'notif_budget_80pct_email', inappKey: 'notif_budget_80pct_inapp' },
  { key: 'budget_100pct', label: 'Orçamento a 100%', emailKey: 'notif_budget_100pct_email', inappKey: 'notif_budget_100pct_inapp' },
  { key: 'recurring_needs_confirm', label: 'Recorrente aguarda confirmação', emailKey: 'notif_recurring_needs_confirm_email', inappKey: 'notif_recurring_needs_confirm_inapp' },
  { key: 'recurring_posted', label: 'Recorrente lançado', emailKey: 'notif_recurring_posted_email', inappKey: 'notif_recurring_posted_inapp' },
  { key: 'card_statement_ready', label: 'Extrato de cartão pronto', emailKey: 'notif_card_statement_ready_email', inappKey: 'notif_card_statement_ready_inapp' },
  { key: 'family_invite', label: 'Convite de família', emailKey: 'notif_family_invite_email', inappKey: 'notif_family_invite_inapp' },
  { key: 'family_audit', label: 'Eventos de família', emailKey: 'notif_family_audit_email', inappKey: 'notif_family_audit_inapp' },
  { key: 'large_inbound', label: 'Entrada elevada', emailKey: 'notif_large_inbound_email', inappKey: 'notif_large_inbound_inapp' },
  { key: 'large_outbound', label: 'Saída elevada', emailKey: 'notif_large_outbound_email', inappKey: 'notif_large_outbound_inapp' },
  { key: 'import_completed', label: 'Importação concluída', emailKey: 'notif_import_completed_email', inappKey: 'notif_import_completed_inapp' },
];

interface Props {
  prefs: UserPreferences;
  onUpdate: (patch: UserPreferencesUpdate) => void;
}

export function NotificationsMatrix({ prefs, onUpdate }: Props) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b">
            <th className="text-left py-2 pr-4 font-medium">Evento</th>
            <th className="text-center py-2 px-4 font-medium">Email</th>
            <th className="text-center py-2 px-4 font-medium">In-app</th>
          </tr>
        </thead>
        <tbody>
          {NOTIF_EVENTS.map((ev) => (
            <tr key={ev.key} className="border-b last:border-0">
              <td className="py-3 pr-4">
                <Label htmlFor={`${ev.key}-email`}>{ev.label}</Label>
              </td>
              <td className="text-center py-3 px-4">
                <Switch
                  id={`${ev.key}-email`}
                  checked={!!prefs[ev.emailKey]}
                  onCheckedChange={(v) => onUpdate({ [ev.emailKey]: v } as UserPreferencesUpdate)}
                  aria-label={`${ev.label} — email`}
                />
              </td>
              <td className="text-center py-3 px-4">
                <Switch
                  id={`${ev.key}-inapp`}
                  checked={!!prefs[ev.inappKey]}
                  onCheckedChange={(v) => onUpdate({ [ev.inappKey]: v } as UserPreferencesUpdate)}
                  aria-label={`${ev.label} — in-app`}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
