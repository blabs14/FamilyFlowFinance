import { useUserPreferences, useUpdateUserPreferences } from '../../../hooks/useUserPreferences';
import { NotificationsMatrix } from '../NotificationsMatrix';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../../components/ui/card';
import { useToast } from '../../../hooks/use-toast';
import type { UserPreferencesUpdate } from '../../../services/userPreferences';

export function NotificationsSettings() {
  const { data: prefs } = useUserPreferences();
  const update = useUpdateUserPreferences();
  const { toast } = useToast();

  const handleUpdate = async (patch: UserPreferencesUpdate) => {
    try {
      await update.mutateAsync(patch);
      toast({ title: 'Notificações atualizadas' });
    } catch {
      toast({ title: 'Erro ao guardar', variant: 'destructive' });
    }
  };

  if (!prefs) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Notificações</CardTitle>
        <CardDescription>Escolhe como queres ser notificado para cada evento.</CardDescription>
      </CardHeader>
      <CardContent>
        <NotificationsMatrix prefs={prefs} onUpdate={handleUpdate} />
      </CardContent>
    </Card>
  );
}
