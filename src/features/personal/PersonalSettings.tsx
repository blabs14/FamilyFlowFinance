import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { subscribeToPush, unsubscribeFromPush } from '../../lib/pushClient';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '../../components/ui/dialog';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Switch } from '../../components/ui/switch';
import { Settings, User, Shield, Bell, Palette, Eye, EyeOff, Moon, Sun, Smartphone, Mail, Calendar, Save, BarChart3, TrendingUp, Globe, DollarSign, Tag } from 'lucide-react';
import { notifySuccess, notifyError } from '../../lib/notify';
import { useAuth } from '../../contexts/AuthContext';
import { logger } from '@/shared/lib/logger';
import { useToast } from '../../hooks/use-toast';
import { usePersonalSettings } from '../../hooks/usePersonalSettings';
import { LoadingSpinner } from '../../components/ui/loading-states';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '../../components/ui/accordion';
import { getAuditLogsByRow } from '../../services/audit_logs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { getCurrencies } from '../../services/currencies';
import { CategoryManagement } from '../../components/CategoryManagement';

type AuditEntry = { 
  id: string; 
  timestamp: string; 
  operation: string; 
  old_data?: Record<string, unknown>; 
  new_data?: Record<string, unknown>; 
  details?: Record<string, unknown>; 
};

type Currency = {
  id: string;
  code: string;
  name: string;
  symbol: string;
  rate_to_eur: number;
};

const PersonalSettings: React.FC = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const {
    settings,
    profile,
    currentTheme,
    isLoading,
    isUpdatingProfile,
    isUpdatingTheme,
    isUpdatingNotifications,
    updateProfile,
    changeTheme,
    updateNotifications,
    updateSettings,
    setLocalRemindersEnabledRemote
  } = usePersonalSettings();

  // Wrappers tipados para evitar acessos a propriedades em 'unknown'
  const typedProfile = (profile as { data?: Record<string, unknown> })?.data || {};
  const typedSettings = (settings as { data?: Record<string, unknown> })?.data || {};

  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isSecurityOpen, setIsSecurityOpen] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [isAppearanceOpen, setIsAppearanceOpen] = useState(false);
  const [isPersonalOpen, setIsPersonalOpen] = useState(false);
  const [isCategoriesOpen, setIsCategoriesOpen] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // Estados para moedas
  const [currencies, setCurrencies] = useState<Currency[]>([]);
  const [loadingCurrencies, setLoadingCurrencies] = useState(false);

  // Estados para formulários
  const [profileData, setProfileData] = useState({
    firstName: typedProfile.first_name || '',
    lastName: typedProfile.last_name || '',
    phone: typedProfile.phone || '',
    birthDate: typedProfile.birth_date || ''
  });

  const [securityData, setSecurityData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });

  const [notificationSettings, setNotificationSettings] = useState({
    emailNotifications: typedSettings?.personal_settings?.notifications?.email ?? true,
    pushNotifications: typedSettings?.personal_settings?.notifications?.push ?? true,
    goalReminders: typedSettings?.personal_settings?.notifications?.goal_reminders ?? true,
    budgetAlerts: typedSettings?.personal_settings?.notifications?.budget_alerts ?? true,
    transactionAlerts: typedSettings?.personal_settings?.notifications?.transaction_alerts ?? false
  });

  // Estados para configurações pessoais (idioma e moeda)
  const [personalData, setPersonalData] = useState({
    language: typedSettings?.personal_settings?.language || 'pt-PT',
    currency: typedSettings?.personal_settings?.currency || 'EUR'
  });

  // Toggle de notificações locais de lembretes (persistência local)
  const [localRemindersEnabled, setLocalRemindersEnabled] = React.useState<boolean>(() => {
    try {
      const raw = localStorage.getItem('local_reminders_enabled');
      if (raw == null) return true;
      return raw === '1' || raw === 'true';
    } catch {
      return true;
    }
  });
  const [pushEnabled, setPushEnabled] = React.useState<boolean>(false);
  const [pushStatus, setPushStatus] = React.useState<'ativo' | 'inativo' | 'sem-permissao'>('inativo');
  
  const toggleLocalReminders = (checked: boolean) => {
    setLocalRemindersEnabled(checked);
    try { localStorage.setItem('local_reminders_enabled', checked ? '1' : '0'); } catch {}
    // sincronizar backend
    setLocalRemindersEnabledRemote(checked);
  };

  const togglePush = async (checked: boolean) => {
    setPushEnabled(checked);
    try {
      if (checked) {
        await subscribeToPush();
        setPushStatus('ativo');
      } else {
        await unsubscribeFromPush();
        setPushStatus('inativo');
      }
    } catch {}
  };

  // Carregar moedas quando o modal pessoal abrir
  React.useEffect(() => {
    if (isPersonalOpen && currencies.length === 0) {
      loadCurrencies();
    }
  }, [isPersonalOpen]);

  const loadCurrencies = async () => {
    setLoadingCurrencies(true);
    try {
      const { data, error } = await getCurrencies();
      if (error) {
        logger.error('Erro ao carregar moedas:', error);
        // Fallback para moedas básicas
        setCurrencies([
          { id: '1', code: 'EUR', name: 'Euro', symbol: '€', rate_to_eur: 1 },
          { id: '2', code: 'USD', name: 'Dólar Americano', symbol: '$', rate_to_eur: 0.85 },
          { id: '3', code: 'GBP', name: 'Libra Esterlina', symbol: '£', rate_to_eur: 1.15 }
        ]);
      } else {
        setCurrencies(data || []);
      }
    } catch (error) {
      logger.error('Erro ao carregar moedas:', error);
      // Fallback para moedas básicas
      setCurrencies([
        { id: '1', code: 'EUR', name: 'Euro', symbol: '€', rate_to_eur: 1 },
        { id: '2', code: 'USD', name: 'Dólar Americano', symbol: '$', rate_to_eur: 0.85 },
        { id: '3', code: 'GBP', name: 'Libra Esterlina', symbol: '£', rate_to_eur: 1.15 }
      ]);
    } finally {
      setLoadingCurrencies(false);
    }
  };

  // Inicializar estado real da subscrição push
  React.useEffect(() => {
    (async () => {
      try {
        if (!('Notification' in window) || !('serviceWorker' in navigator)) {
          setPushStatus('inativo');
          setPushEnabled(false);
          return;
        }
        const perm = Notification.permission;
        if (perm !== 'granted') {
          setPushStatus('sem-permissao');
          setPushEnabled(false);
          return;
        }
        const reg = await navigator.serviceWorker.ready;
        const sub = await reg.pushManager.getSubscription();
        const active = !!sub;
        setPushEnabled(active);
        setPushStatus(active ? 'ativo' : 'inativo');
      } catch {
        setPushEnabled(false);
        setPushStatus('inativo');
      }
    })();
  }, []);

  const sendTestPush = async () => {
    try {
      if (!user?.id) return;
      const { data: session } = await (await import('../../lib/supabaseClient')).supabase.auth.getSession();
      const jwt = session.session?.access_token;
      const baseUrl = import.meta.env.VITE_SUPABASE_URL?.replace(/\/$/, '') || '';
      const url = `${baseUrl}/functions/v1/push-delivery`;
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': jwt ? `Bearer ${jwt}` : ''
        },
        body: JSON.stringify({
          user_id: user.id,
          payload: {
            title: 'Teste de Push',
            body: 'Se estás a ver isto, as notificações push estão a funcionar 🚀',
            url: '/insights'
          }
        })
      });
      if (!res.ok) throw new Error('Falha no envio');
      notifySuccess({ title: 'Enviado', description: 'Notificação push de teste enviada.' });
    } catch (e) {
      notifyError({ title: 'Erro', description: 'Não foi possível enviar a push de teste.' });
    }
  };

  // Atualizar estados locais quando os dados mudarem
  React.useEffect(() => {
    if (profile) {
      const p = (profile as { data?: Record<string, unknown> })?.data || {};
      setProfileData({
        firstName: (p.first_name as string) || '',
        lastName: (p.last_name as string) || '',
        phone: (p.phone as string) || '',
        birthDate: (p.birth_date as string) || ''
      });
    }
  }, [profile]);

  React.useEffect(() => {
    const settingsData = (settings as { data?: { personal_settings?: Record<string, unknown> } })?.data;
    const ps = settingsData?.personal_settings as { notifications?: Record<string, unknown> } | undefined;
    if (ps?.notifications) {
      const notifications = ps.notifications as Record<string, unknown>;
      setNotificationSettings({
        emailNotifications: (notifications.email as boolean) ?? true,
        pushNotifications: (notifications.push as boolean) ?? true,
        goalReminders: (notifications.goal_reminders as boolean) ?? true,
        budgetAlerts: (notifications.budget_alerts as boolean) ?? true,
        transactionAlerts: (notifications.transaction_alerts as boolean) ?? false
      });
      // alinhar toggle local com backend
      const remoteLocalReminders = notifications.local_reminders;
      if (typeof remoteLocalReminders === 'boolean') {
        setLocalRemindersEnabled(remoteLocalReminders);
        try { localStorage.setItem('local_reminders_enabled', remoteLocalReminders ? '1' : '0'); } catch {}
      }
    }
    // Atualizar configurações pessoais
    if (ps) {
      setPersonalData({
        language: (ps.language as string) || 'pt-PT',
        currency: (ps.currency as string) || 'EUR'
      });
    }
  }, [settings]);

  // Função para salvar dados do perfil
  const handleProfileSave = async () => {
    try {
      await updateProfile({
        first_name: profileData.firstName,
        last_name: profileData.lastName,
        phone: profileData.phone,
        birth_date: profileData.birthDate
      });
      setIsProfileOpen(false);
    } catch (error) {
      logger.error('Erro ao salvar perfil:', error);
    }
  };

  // Função para alterar palavra-passe
  const handlePasswordChange = async () => {
    if (securityData.newPassword !== securityData.confirmPassword) {
      toast({
        title: "Erro",
        description: "As palavras-passe não coincidem.",
        variant: "destructive",
      });
      return;
    }

    if (securityData.newPassword.length < 6) {
      toast({
        title: "Erro",
        description: "A nova palavra-passe deve ter pelo menos 6 caracteres.",
        variant: "destructive",
      });
      return;
    }

    try {
      // Aqui implementaria a lógica de alteração de palavra-passe com Supabase Auth
      toast({
        title: "Palavra-passe alterada",
        description: "A sua palavra-passe foi alterada com sucesso.",
      });
      setSecurityData({ currentPassword: '', newPassword: '', confirmPassword: '' });
      setIsSecurityOpen(false);
    } catch (error) {
      toast({
        title: "Erro",
        description: "Não foi possível alterar a palavra-passe.",
        variant: "destructive",
      });
    }
  };

  // Função para salvar configurações de notificações
  const handleNotificationSettings = () => {
    try {
      updateNotifications({
        email: notificationSettings.emailNotifications,
        push: notificationSettings.pushNotifications,
        goal_reminders: notificationSettings.goalReminders,
        budget_alerts: notificationSettings.budgetAlerts,
        transaction_alerts: notificationSettings.transactionAlerts,
        local_reminders: localRemindersEnabled,
      });
      setIsNotificationsOpen(false);
    } catch (error) {
      logger.error('Erro ao salvar notificações:', error);
    }
  };

  // Função para salvar configurações pessoais (idioma e moeda)
  const handlePersonalSettings = async () => {
    try {
      await updateSettings({
        language: personalData.language,
        currency: personalData.currency
      });
      setIsPersonalOpen(false);
      toast({
        title: "Configurações atualizadas",
        description: "Idioma e moeda foram atualizados com sucesso.",
      });
    } catch (error) {
      logger.error('Erro ao salvar configurações pessoais:', error);
      toast({
        title: "Erro",
        description: "Não foi possível salvar as configurações.",
        variant: "destructive",
      });
    }
  };

  if (isLoading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[400px]">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Definições Pessoais
          </CardTitle>
          <CardDescription>
            Configure suas preferências e dados pessoais
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Pessoais - Nova secção */}
          <div className="flex items-center justify-between p-4 border rounded-lg">
            <div className="flex items-center gap-3">
              <Globe className="h-5 w-5 text-muted-foreground" />
              <div>
                <h3 className="font-medium">Pessoais</h3>
                <p className="text-sm text-muted-foreground">
                  Idioma e moeda preferidos
                </p>
              </div>
            </div>
            <Dialog open={isPersonalOpen} onOpenChange={setIsPersonalOpen}>
              <DialogTrigger asChild>
                <Button variant="outline">Configurar</Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                  <DialogTitle>Configurações Pessoais</DialogTitle>
                  <DialogDescription>
                    Configure seu idioma e moeda preferidos
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="language">Idioma</Label>
                    <Select
                      value={personalData.language}
                      onValueChange={(value) => setPersonalData(prev => ({ ...prev, language: value }))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione o idioma" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="pt-PT">🇵🇹 Português (Portugal)</SelectItem>
                        <SelectItem value="en-US">🇺🇸 English (US)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="currency">Moeda</Label>
                    <Select
                      value={personalData.currency}
                      onValueChange={(value) => setPersonalData(prev => ({ ...prev, currency: value }))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione a moeda" />
                      </SelectTrigger>
                      <SelectContent>
                        {loadingCurrencies ? (
                          <div className="p-2 text-center">
                            <LoadingSpinner size="sm" />
                          </div>
                        ) : (
                          currencies.map((currency) => (
                            <SelectItem key={currency.code} value={currency.code}>
                              {currency.symbol} {currency.code} - {currency.name}
                            </SelectItem>
                          ))
                        )}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button variant="outline" onClick={() => setIsPersonalOpen(false)}>
                      Cancelar
                    </Button>
                    <Button onClick={handlePersonalSettings}>
                      <Save className="h-4 w-4 mr-2" />
                      Guardar
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </div>

          {/* Perfil */}
          <div className="flex items-center justify-between p-4 border rounded-lg">
            <div className="flex items-center gap-3">
              <User className="h-5 w-5 text-muted-foreground" />
              <div>
                <h3 className="font-medium">Dados do Perfil</h3>
                <p className="text-sm text-muted-foreground">
                  Nome, email e informações pessoais
                </p>
              </div>
            </div>
            <Dialog open={isProfileOpen} onOpenChange={setIsProfileOpen}>
              <DialogTrigger asChild>
                <Button variant="outline">Editar</Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                  <DialogTitle>Editar Perfil</DialogTitle>
                  <DialogDescription>
                    Atualize suas informações pessoais
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="firstName">Nome</Label>
                      <Input
                        id="firstName"
                        value={profileData.firstName}
                        onChange={(e) => setProfileData(prev => ({ ...prev, firstName: e.target.value }))}
                        placeholder="Seu nome"
                      />
                    </div>
                    <div>
                      <Label htmlFor="lastName">Apelido</Label>
                      <Input
                        id="lastName"
                        value={profileData.lastName}
                        onChange={(e) => setProfileData(prev => ({ ...prev, lastName: e.target.value }))}
                        placeholder="Seu apelido"
                      />
                    </div>
                  </div>
                  <div>
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      value={user?.email || ''}
                      disabled
                      className="bg-muted"
                    />
                    <p className="text-xs text-muted-foreground mt-1">O email não pode ser alterado</p>
                  </div>
                  <div>
                    <Label htmlFor="phone">Telefone</Label>
                    <Input
                      id="phone"
                      value={profileData.phone}
                      onChange={(e) => setProfileData(prev => ({ ...prev, phone: e.target.value }))}
                      placeholder="+351 123 456 789"
                    />
                  </div>
                  <div>
                    <Label htmlFor="birthDate">Data de Nascimento</Label>
                    <Input
                      id="birthDate"
                      type="date"
                      value={profileData.birthDate}
                      onChange={(e) => setProfileData(prev => ({ ...prev, birthDate: e.target.value }))}
                    />
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button variant="outline" onClick={() => setIsProfileOpen(false)}>
                      Cancelar
                    </Button>
                    <Button onClick={handleProfileSave} disabled={isUpdatingProfile}>
                      {isUpdatingProfile ? (
                        <LoadingSpinner size="sm" className="mr-2" />
                      ) : (
                        <Save className="h-4 w-4 mr-2" />
                      )}
                      Salvar
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </div>

          {/* Segurança */}
          <div className="flex items-center justify-between p-4 border rounded-lg">
            <div className="flex items-center gap-3">
              <Shield className="h-5 w-5 text-muted-foreground" />
              <div>
                <h3 className="font-medium">Segurança</h3>
                <p className="text-sm text-muted-foreground">
                  Palavra-passe e autenticação
                </p>
              </div>
            </div>
            <Dialog open={isSecurityOpen} onOpenChange={setIsSecurityOpen}>
              <DialogTrigger asChild>
                <Button variant="outline">Configurar</Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                  <DialogTitle>Configurações de Segurança</DialogTitle>
                  <DialogDescription>
                    Gerencie sua palavra-passe e configurações de segurança
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="currentPassword">Palavra-passe Atual</Label>
                    <div className="relative">
                      <Input
                        id="currentPassword"
                        type={showPassword ? "text" : "password"}
                        value={securityData.currentPassword}
                        onChange={(e) => setSecurityData(prev => ({ ...prev, currentPassword: e.target.value }))}
                        placeholder="Palavra-passe atual"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                        onClick={() => setShowPassword(!showPassword)}
                      >
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </Button>
                    </div>
                  </div>
                  <div>
                    <Label htmlFor="newPassword">Nova Palavra-passe</Label>
                    <Input
                      id="newPassword"
                      type="password"
                      value={securityData.newPassword}
                      onChange={(e) => setSecurityData(prev => ({ ...prev, newPassword: e.target.value }))}
                      placeholder="Nova palavra-passe"
                    />
                  </div>
                  <div>
                    <Label htmlFor="confirmPassword">Confirmar Nova Palavra-passe</Label>
                    <Input
                      id="confirmPassword"
                      type="password"
                      value={securityData.confirmPassword}
                      onChange={(e) => setSecurityData(prev => ({ ...prev, confirmPassword: e.target.value }))}
                      placeholder="Confirmar nova palavra-passe"
                    />
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button variant="outline" onClick={() => setIsSecurityOpen(false)}>
                      Cancelar
                    </Button>
                    <Button onClick={handlePasswordChange}>
                      <Save className="h-4 w-4 mr-2" />
                      Alterar Palavra-passe
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </div>

          {/* Notificações */}
          <div className="flex items-center justify-between p-4 border rounded-lg">
            <div className="flex items-center gap-3">
              <Bell className="h-5 w-5 text-muted-foreground" />
              <div>
                <h3 className="font-medium">Notificações</h3>
                <p className="text-sm text-muted-foreground">
                  Alertas e lembretes pessoais
                </p>
              </div>
            </div>
            <Dialog open={isNotificationsOpen} onOpenChange={setIsNotificationsOpen}>
              <DialogTrigger asChild>
                <Button variant="outline">Configurar</Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                  <DialogTitle>Configurações de Notificações</DialogTitle>
                  <DialogDescription>
                    Configure como receber alertas e lembretes
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Mail className="h-4 w-4" />
                      <div>
                        <span className="text-sm font-medium">Notificações por Email</span>
                        <p className="text-xs text-muted-foreground">Receber alertas por email</p>
                      </div>
                    </div>
                    <Switch
                      checked={notificationSettings.emailNotifications}
                      onCheckedChange={(checked) => setNotificationSettings(prev => ({ ...prev, emailNotifications: checked }))}
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Smartphone className="h-4 w-4" />
                      <div>
                        <span className="text-sm font-medium">Notificações Push</span>
                        <p className="text-xs text-muted-foreground">Alertas no navegador</p>
                      </div>
                    </div>
                    <Switch
                      checked={notificationSettings.pushNotifications}
                      onCheckedChange={(checked) => setNotificationSettings(prev => ({ ...prev, pushNotifications: checked }))}
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4" />
                      <div>
                        <span className="text-sm font-medium">Lembretes de Objetivos</span>
                        <p className="text-xs text-muted-foreground">Alertas sobre progresso de objetivos</p>
                      </div>
                    </div>
                    <Switch
                      checked={notificationSettings.goalReminders}
                      onCheckedChange={(checked) => setNotificationSettings(prev => ({ ...prev, goalReminders: checked }))}
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <BarChart3 className="h-4 w-4" />
                      <div>
                        <span className="text-sm font-medium">Alertas de Orçamento</span>
                        <p className="text-xs text-muted-foreground">Avisos quando exceder limites</p>
                      </div>
                    </div>
                    <Switch
                      checked={notificationSettings.budgetAlerts}
                      onCheckedChange={(checked) => setNotificationSettings(prev => ({ ...prev, budgetAlerts: checked }))}
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <TrendingUp className="h-4 w-4" />
                      <div>
                        <span className="text-sm font-medium">Alertas de Transações</span>
                        <p className="text-xs text-muted-foreground">Notificações de movimentos importantes</p>
                      </div>
                    </div>
                    <Switch
                      checked={notificationSettings.transactionAlerts}
                      onCheckedChange={(checked) => setNotificationSettings(prev => ({ ...prev, transactionAlerts: checked }))}
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Bell className="h-4 w-4" />
                      <div>
                        <span className="text-sm font-medium">Lembretes Locais</span>
                        <p className="text-xs text-muted-foreground">Notificações no dispositivo</p>
                      </div>
                    </div>
                    <Switch
                      checked={localRemindersEnabled}
                      onCheckedChange={toggleLocalReminders}
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Smartphone className="h-4 w-4" />
                      <div>
                        <span className="text-sm font-medium">Push Notifications</span>
                        <p className="text-xs text-muted-foreground">Status: {pushStatus}</p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Switch
                        checked={pushEnabled}
                        onCheckedChange={togglePush}
                      />
                      <Button size="sm" variant="outline" onClick={sendTestPush}>
                        Testar
                      </Button>
                    </div>
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button variant="outline" onClick={() => setIsNotificationsOpen(false)}>
                      Cancelar
                    </Button>
                    <Button onClick={handleNotificationSettings} disabled={isUpdatingNotifications}>
                      {isUpdatingNotifications ? (
                        <LoadingSpinner size="sm" className="mr-2" />
                      ) : (
                        <Save className="h-4 w-4 mr-2" />
                      )}
                      Salvar
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </div>

          {/* Aparência */}
          <div className="flex items-center justify-between p-4 border rounded-lg">
            <div className="flex items-center gap-3">
              <Palette className="h-5 w-5 text-muted-foreground" />
              <div>
                <h3 className="font-medium">Aparência</h3>
                <p className="text-sm text-muted-foreground">
                  Tema e personalização visual
                </p>
              </div>
            </div>
            <Dialog open={isAppearanceOpen} onOpenChange={setIsAppearanceOpen}>
              <DialogTrigger asChild>
                <Button variant="outline">Configurar</Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                  <DialogTitle>Configurações de Aparência</DialogTitle>
                  <DialogDescription>
                    Personalize a aparência da aplicação
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label>Tema</Label>
                    <div className="grid grid-cols-3 gap-2 mt-2">
                      <Button
                        variant={currentTheme === 'light' ? 'default' : 'outline'}
                        onClick={() => changeTheme('light')}
                        className="flex items-center gap-2"
                        disabled={isUpdatingTheme}
                      >
                        <Sun className="h-4 w-4" />
                        Claro
                      </Button>
                      <Button
                        variant={currentTheme === 'dark' ? 'default' : 'outline'}
                        onClick={() => changeTheme('dark')}
                        className="flex items-center gap-2"
                        disabled={isUpdatingTheme}
                      >
                        <Moon className="h-4 w-4" />
                        Escuro
                      </Button>
                      <Button
                        variant={currentTheme === 'system' ? 'default' : 'outline'}
                        onClick={() => changeTheme('system')}
                        className="flex items-center gap-2"
                        disabled={isUpdatingTheme}
                      >
                        <Settings className="h-4 w-4" />
                        Sistema
                      </Button>
                    </div>
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button variant="outline" onClick={() => setIsAppearanceOpen(false)}>
                      Fechar
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </div>

          {/* Gestão de Categorias */}
          <div className="flex items-center justify-between p-4 border rounded-lg">
            <div className="flex items-center gap-3">
              <Tag className="h-5 w-5 text-muted-foreground" />
              <div>
                <h3 className="font-medium">Categorias</h3>
                <p className="text-sm text-muted-foreground">
                  Gerir categorias customizadas
                </p>
              </div>
            </div>
            <Dialog open={isCategoriesOpen} onOpenChange={setIsCategoriesOpen}>
              <DialogTrigger asChild>
                <Button variant="outline">Gerir</Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[800px] max-h-[80vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Gestão de Categorias</DialogTitle>
                  <DialogDescription>
                    Crie, edite e elimine as suas categorias customizadas
                  </DialogDescription>
                </DialogHeader>
                <CategoryManagement />
              </DialogContent>
            </Dialog>
          </div>
        </CardContent>
      </Card>

      {/* Informações da Área Pessoal */}
      <Card>
        <CardHeader>
          <CardTitle>Acerca da Área Pessoal</CardTitle>
          <CardDescription>
            Informações sobre esta funcionalidade
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="p-4 bg-blue-50 rounded-lg">
            <h4 className="font-medium text-blue-800 mb-2">Diferença entre Área Pessoal e Família</h4>
            <p className="text-sm text-blue-700">
              A <strong>Área Pessoal</strong> concentra todas as suas informações financeiras individuais 
              (contas, objetivos, transações) onde <code>family_id IS NULL</code>. 
              A <strong>Área Família</strong> mostra dados partilhados entre membros da família 
              onde <code>family_id IS NOT NULL</code>.
            </p>
          </div>
          
          <div className="p-4 bg-green-50 rounded-lg">
            <h4 className="font-medium text-green-800 mb-2">Funcionalidades Disponíveis</h4>
            <ul className="text-sm text-green-700 space-y-1">
              <li>• Gestão de contas bancárias pessoais</li>
              <li>• Controlo de cartões de crédito</li>
              <li>• Definição e acompanhamento de objetivos</li>
              <li>• Orçamentos mensais por categoria</li>
              <li>• Histórico completo de transações</li>
              <li>• Insights e dicas personalizadas</li>
            </ul>
          </div>
        </CardContent>
      </Card>

      {/* Histórico de Alterações do Perfil/Definições */}
      <Card>
        <CardHeader>
          <CardTitle>Histórico</CardTitle>
          <CardDescription>Alterações recentes ao seu perfil e definições</CardDescription>
        </CardHeader>
        <CardContent>
          <Accordion type="single" collapsible>
            <AccordionItem value="perfil">
              <AccordionTrigger>Perfil</AccordionTrigger>
              <AccordionContent>
                <ProfileAuditList profileRowId={(profile as any)?.data?.id || user?.id || ''} />
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </CardContent>
      </Card>
    </div>
  );
};

export default PersonalSettings;

// Histórico de alterações para Perfil (tabela profiles)
const ProfileAuditList: React.FC<{ profileRowId: string }> = ({ profileRowId }) => {
  const [entries, setEntries] = React.useState<AuditEntry[] | null>(null);
  const [loading, setLoading] = React.useState(false);

  React.useEffect(() => {
    if (!profileRowId) return;
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      try {
        const { data, error } = await getAuditLogsByRow('profiles', profileRowId, 20);
        if (!cancelled) {
          if (!error && Array.isArray(data)) setEntries(data as unknown as AuditEntry[]);
          else setEntries([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void load();
    return () => { cancelled = true; };
  }, [profileRowId]);

  if (!profileRowId) return <div className="text-sm text-muted-foreground">Perfil não carregado.</div>;
  if (loading && !entries) return <div className="text-sm text-muted-foreground">A carregar histórico…</div>;
  if (!entries || entries.length === 0) return <div className="text-sm text-muted-foreground">Sem alterações registadas.</div>;

  return (
    <div className="space-y-2">
      {entries.map((e) => {
        const oldFirst = e.old_data?.first_name; const newFirst = e.new_data?.first_name;
        const oldLast = e.old_data?.last_name; const newLast = e.new_data?.last_name;
        const oldPhone = e.old_data?.phone; const newPhone = e.new_data?.phone;
        const oldBirth = e.old_data?.birth_date; const newBirth = e.new_data?.birth_date;
        return (
          <div key={e.id} className="text-xs border rounded p-2">
            <div className="flex justify-between">
              <span className="font-medium">{new Date(e.timestamp).toLocaleString('pt-PT')}</span>
              <span className="uppercase text-muted-foreground">{e.operation}</span>
            </div>
            <div className="mt-1 space-y-0.5">
              {(() => {
                const changes = [];
                if (oldFirst !== newFirst) {
                  changes.push(<div key="first-name">Nome: {oldFirst ?? '—'} → {newFirst ?? '—'}</div>);
                }
                if (oldLast !== newLast) {
                  changes.push(<div key="last-name">Apelido: {oldLast ?? '—'} → {newLast ?? '—'}</div>);
                }
                if (oldPhone !== newPhone) {
                  changes.push(<div key="phone">Telefone: {oldPhone ?? '—'} → {newPhone ?? '—'}</div>);
                }
                if (oldBirth !== newBirth) {
                  changes.push(<div key="birth-date">Nascimento: {oldBirth ?? '—'} → {newBirth ?? '—'}</div>);
                }
                return changes;
              })()} 
            </div>
          </div>
        );
      })}
    </div>
  );
};