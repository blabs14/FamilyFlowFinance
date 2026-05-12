import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../../contexts/AuthContext';
import { supabase } from '../../../lib/supabaseClient';
import { AvatarUploader } from '../AvatarUploader';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { Label } from '../../../components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '../../../components/ui/card';
import { Alert, AlertDescription } from '../../../components/ui/alert';
import { useToast } from '../../../hooks/use-toast';
import { Loader2 } from 'lucide-react';
import { useProfile, useUpdateProfile } from '../../../hooks/useProfilesQuery';
import { useUpdateUserPreferences } from '../../../hooks/useUserPreferences';

export function ProfileSettings() {
  const { user } = useAuth();
  const { toast } = useToast();
  const nav = useNavigate();

  const { data: profile } = useProfile();
  const updateProfile = useUpdateProfile();
  const updatePrefs = useUpdateUserPreferences();

  const [nome, setNome] = useState('');
  const [fotoUrl, setFotoUrl] = useState('');
  const [profileSynced, setProfileSynced] = useState(false);
  const [isReverting, setIsReverting] = useState(false);

  // Sync from profile when loaded (only once)
  useEffect(() => {
    if (profile && !profileSynced) {
      setNome(profile.nome ?? '');
      setFotoUrl(profile.foto_url ?? '');
      setProfileSynced(true);
    }
  }, [profile, profileSynced]);

  // Password change state
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [pwError, setPwError] = useState('');
  const [pwSaving, setPwSaving] = useState(false);

  const handleSaveProfile = async () => {
    if (!profile?.id) return;
    await updateProfile.mutateAsync({
      id: profile.id,
      data: { nome, foto_url: fotoUrl || undefined },
    });
  };

  const handlePasswordChange = async () => {
    if (newPassword.length < 8) {
      setPwError('Password deve ter pelo menos 8 caracteres.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPwError('As passwords não coincidem.');
      return;
    }
    setPwError('');
    setPwSaving(true);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    setPwSaving(false);
    if (error) {
      setPwError(error.message);
    } else {
      setNewPassword('');
      setConfirmPassword('');
      toast({ title: 'Password alterada com sucesso' });
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader><CardTitle>Informação Pessoal</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <AvatarUploader
            currentUrl={fotoUrl || null}
            onUploaded={(url) => setFotoUrl(url)}
          />
          <div className="space-y-2">
            <Label htmlFor="nome">Nome</Label>
            <Input
              id="nome"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="O seu nome"
              aria-label="Nome completo"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              value={user?.email ?? ''}
              disabled
              aria-label="Endereço de email"
            />
            <p className="text-xs text-muted-foreground">Email não pode ser alterado aqui.</p>
          </div>
          <div className="flex gap-2">
            <Button onClick={handleSaveProfile} disabled={updateProfile.isPending}>
              {updateProfile.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Guardar perfil
            </Button>
            <Button
              variant="ghost"
              size="sm"
              disabled={isReverting}
              onClick={async () => {
                setIsReverting(true);
                try {
                  await updatePrefs.mutateAsync({ onboarding_completed_at: null });
                  nav('/app/onboarding');
                } catch {
                  toast({ title: 'Erro ao reiniciar onboarding', variant: 'destructive' });
                } finally {
                  setIsReverting(false);
                }
              }}
            >
              {isReverting ? 'A processar...' : 'Rever onboarding'}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Alterar Password</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          {pwError && (
            <Alert variant="destructive">
              <AlertDescription>{pwError}</AlertDescription>
            </Alert>
          )}
          <div className="space-y-2">
            <Label htmlFor="new-pw">Nova password</Label>
            <Input
              id="new-pw"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Mínimo 8 caracteres"
              aria-label="Nova password"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirm-pw">Confirmar password</Label>
            <Input
              id="confirm-pw"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Repetir nova password"
              aria-label="Confirmar nova password"
            />
          </div>
          <Button onClick={handlePasswordChange} disabled={pwSaving}>
            {pwSaving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            Guardar nova password
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
