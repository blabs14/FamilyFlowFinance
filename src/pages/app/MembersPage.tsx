// src/pages/app/MembersPage.tsx
import React from 'react';
import { Navigate } from 'react-router-dom';
import { useScope } from '@/features/scope';
import { useAuth } from '@/contexts/AuthContext';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { LoadingSpinner } from '@/components/ui/loading-states';
import {
  useFamilyMembers,
  useTransferOwnership,
  useSoftRemoveFamilyMember,
} from '@/hooks/useFamilyMembersQuery';
import { useMemberBalances } from '@/hooks/useFamilySplitsQuery';
import { useToast } from '@/hooks/use-toast';
import { formatMoney } from '@/lib/money';
import { Crown, Shield, User, Eye } from 'lucide-react';

const ROLE_CONFIG: Record<string, {
  label: string;
  Icon: React.ElementType;
  variant: 'default' | 'secondary' | 'outline' | 'destructive';
}> = {
  owner:  { label: 'Owner',         Icon: Crown,  variant: 'default' },
  admin:  { label: 'Administrador', Icon: Shield, variant: 'secondary' },
  member: { label: 'Membro',        Icon: User,   variant: 'outline' },
  viewer: { label: 'Visualizador',  Icon: Eye,    variant: 'outline' },
};

export default function MembersPage() {
  const { scope } = useScope();
  const { user } = useAuth();
  const { toast } = useToast();

  if (scope.kind !== 'family') return <Navigate to="/app" replace />;

  const familyId = (scope as any).familyId as string;
  const { data: members = [], isLoading } = useFamilyMembers();
  const { data: balances = [] } = useMemberBalances();
  const transferOwnership = useTransferOwnership();
  const softRemove = useSoftRemoveFamilyMember();

  const myRole = (members as any[]).find((m) => m.user_id === user?.id)?.role;
  const isOwnerOrAdmin = myRole === 'owner' || myRole === 'admin';

  const handleRemove = async (userId: string, name: string) => {
    if (!confirm(`Remover ${name} da família?`)) return;
    try {
      await softRemove.mutateAsync({ familyId, userId, reason: 'Removido pelo administrador' });
      toast({ title: `${name} foi removido da família` });
    } catch (e: any) {
      toast({ title: 'Erro ao remover membro', description: e.message, variant: 'destructive' });
    }
  };

  const handleTransferOwnership = async (userId: string, name: string) => {
    if (!confirm(`Transferir ownership para ${name}? Perderás o teu acesso de owner.`)) return;
    try {
      await transferOwnership.mutateAsync({ familyId, newOwnerUserId: userId });
      toast({ title: `Ownership transferido para ${name}` });
    } catch (e: any) {
      toast({ title: 'Erro ao transferir ownership', description: e.message, variant: 'destructive' });
    }
  };

  const getBalance = (userId: string) =>
    (balances as any[]).find((b) => b.user_id === userId)?.balance_cents ?? 0;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  const activeMembers = (members as any[]).filter((m) => m.status !== 'removed');

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div>
        <h1 className="text-2xl font-bold">Membros da Família</h1>
        <p className="text-sm text-muted-foreground">
          {activeMembers.length} membro{activeMembers.length !== 1 ? 's' : ''} ativo{activeMembers.length !== 1 ? 's' : ''}
        </p>
      </div>

      <div className="space-y-3">
        {activeMembers.map((member: any) => {
          const cfg = ROLE_CONFIG[member.role] ?? ROLE_CONFIG.member;
          const name = member.profiles?.nome ?? member.user_id;
          const balanceCents = getBalance(member.user_id);
          const isMe = member.user_id === user?.id;

          return (
            <div key={member.id} className="rounded-lg border bg-card p-4">
              <div className="flex items-center justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-semibold text-base">{name}</span>
                    {isMe && (
                      <span className="text-sm text-muted-foreground">(tu)</span>
                    )}
                    <Badge variant={cfg.variant} className="text-xs gap-1">
                      <cfg.Icon className="h-3 w-3" />
                      {cfg.label}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Desde {new Date(member.joined_at).toLocaleDateString('pt-PT')}
                    {balanceCents !== 0 && (
                      <>
                        {' · Saldo: '}
                        <span className={balanceCents > 0 ? 'text-green-600' : 'text-red-600'}>
                          {formatMoney(Math.abs(balanceCents))}
                        </span>
                      </>
                    )}
                  </p>
                </div>

                {isOwnerOrAdmin && !isMe && (
                  <div className="flex gap-1 shrink-0">
                    {myRole === 'owner' && member.role !== 'owner' && (
                      <Button
                        size="sm" variant="ghost"
                        onClick={() => handleTransferOwnership(member.user_id, name)}
                      >
                        Transferir Owner
                      </Button>
                    )}
                    {member.role !== 'owner' && (
                      <Button
                        size="sm" variant="ghost"
                        className="text-destructive hover:text-destructive"
                        onClick={() => handleRemove(member.user_id, name)}
                      >
                        Remover
                      </Button>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
