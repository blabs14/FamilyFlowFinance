import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/tabs';
import { ProfileSettings } from '../../features/settings/tabs/ProfileSettings';
import { PreferencesSettings } from '../../features/settings/tabs/PreferencesSettings';
import { NotificationsSettings } from '../../features/settings/tabs/NotificationsSettings';
import { DataPrivacySettings } from '../../features/settings/tabs/DataPrivacySettings';
import { FamilySettingsPanel } from '../../features/settings/tabs/FamilySettingsPanel';
import { ImportRulesManager } from '../../features/settings/ImportRulesManager';
import { useScope } from '../../features/scope';
import { useFamilyRole } from '../../hooks/useFamilyRole';

export default function SettingsPage() {
  const { scope, activeFamily } = useScope();
  const role = useFamilyRole(activeFamily?.id);
  const showFamilyTab = scope === 'family' && (role === 'owner' || role === 'admin');

  return (
    <div className="container max-w-3xl py-8">
      <h1 className="text-2xl font-bold mb-6">Definições</h1>
      <Tabs defaultValue="profile">
        <TabsList className="mb-6 flex flex-wrap gap-1">
          <TabsTrigger value="profile">Perfil</TabsTrigger>
          <TabsTrigger value="preferences">Preferências</TabsTrigger>
          <TabsTrigger value="notifications">Notificações</TabsTrigger>
          <TabsTrigger value="data-privacy">Dados & Privacidade</TabsTrigger>
          {showFamilyTab && <TabsTrigger value="family">Família</TabsTrigger>}
        </TabsList>
        <TabsContent value="profile"><ProfileSettings /></TabsContent>
        <TabsContent value="preferences"><PreferencesSettings /></TabsContent>
        <TabsContent value="notifications"><NotificationsSettings /></TabsContent>
        <TabsContent value="data-privacy">
          <DataPrivacySettings />
          <div className="mt-6"><ImportRulesManager /></div>
        </TabsContent>
        {showFamilyTab && <TabsContent value="family"><FamilySettingsPanel /></TabsContent>}
      </Tabs>
    </div>
  );
}
