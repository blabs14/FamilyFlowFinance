import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../../../contexts/AuthContext';
import { useScope } from '../../../features/scope';
import { supabase } from '../../../lib/supabaseClient';
import { Card, CardContent, CardHeader, CardTitle } from '../../../components/ui/card';
import { Badge } from '../../../components/ui/badge';

interface Member {
  id: string;
  user_id: string;
  role: string;
  profiles: { nome: string; foto_url: string | null };
}

export function FamilySettingsPanel() {
  const { user } = useAuth();
  const { activeFamily } = useScope();

  const { data: members = [] } = useQuery({
    queryKey: ['family-members', activeFamily?.id],
    queryFn: async () => {
      if (!activeFamily?.id) return [];
      const { data, error } = await supabase
        .from('family_members')
        .select('id, user_id, role, profiles(nome, foto_url)')
        .eq('family_id', activeFamily.id);
      if (error) throw error;
      return data as Member[];
    },
    enabled: !!activeFamily?.id,
  });

  if (!activeFamily) return <p className="text-muted-foreground">Nenhuma família activa.</p>;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>{activeFamily.name}</CardTitle>
        </CardHeader>
        <CardContent>
          <h3 className="text-sm font-medium mb-3">Membros</h3>
          <ul className="space-y-2">
            {members.map((m) => (
              <li key={m.id} className="flex items-center justify-between">
                <span>{m.profiles?.nome ?? m.user_id}</span>
                <Badge variant={m.role === 'owner' ? 'default' : 'secondary'}>
                  {m.role}
                </Badge>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
