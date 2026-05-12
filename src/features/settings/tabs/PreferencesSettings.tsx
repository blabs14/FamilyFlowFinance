import { useUserPreferences, useUpdateUserPreferences } from '../../../hooks/useUserPreferences';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../../components/ui/select';
import { Switch } from '../../../components/ui/switch';
import { Label } from '../../../components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '../../../components/ui/card';
import { useToast } from '../../../hooks/use-toast';

export function PreferencesSettings() {
  const { data: prefs } = useUserPreferences();
  const update = useUpdateUserPreferences();
  const { toast } = useToast();

  const save = async (patch: Parameters<typeof update.mutateAsync>[0]) => {
    try {
      await update.mutateAsync(patch);
      toast({ title: 'Preferências guardadas' });
    } catch {
      toast({ title: 'Erro ao guardar', variant: 'destructive' });
    }
  };

  if (!prefs) return null;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader><CardTitle>Aparência</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="theme-select">Tema</Label>
            <Select value={prefs.theme} onValueChange={(v) => save({ theme: v as 'light' | 'dark' | 'system' })}>
              <SelectTrigger id="theme-select" aria-label="Tema"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="system">Sistema</SelectItem>
                <SelectItem value="light">Claro</SelectItem>
                <SelectItem value="dark">Escuro</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center justify-between">
            <Label htmlFor="compact-mode">Modo compacto</Label>
            <Switch id="compact-mode" checked={prefs.compact_mode} onCheckedChange={(v) => save({ compact_mode: v })} />
          </div>
          <div className="flex items-center justify-between">
            <Label htmlFor="show-currency">Mostrar símbolo de divisa</Label>
            <Switch id="show-currency" checked={prefs.show_currency_symbol} onCheckedChange={(v) => save({ show_currency_symbol: v })} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Regional</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="lang-select">Idioma</Label>
            <Select value={prefs.language} onValueChange={(v) => save({ language: v as 'pt-PT' | 'en-US' })}>
              <SelectTrigger id="lang-select" aria-label="Idioma"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="pt-PT">Português (PT)</SelectItem>
                <SelectItem value="en-US">English (US)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="currency-select">Moeda</Label>
            <Select value={prefs.currency} onValueChange={(v) => save({ currency: v })}>
              <SelectTrigger id="currency-select" aria-label="Moeda"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="EUR">EUR — Euro</SelectItem>
                <SelectItem value="USD">USD — Dólar americano</SelectItem>
                <SelectItem value="GBP">GBP — Libra esterlina</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
