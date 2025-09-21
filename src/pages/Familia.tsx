import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { useFamilyData, useCreateFamily, useFamilyStatistics } from '../hooks/useFamilyQuery';
import { FamilyInviteModal } from '../components/family/FamilyInviteModal';
import { FamilyMembersList } from '../components/family/FamilyMembersList';
import { PendingInvitesList } from '../components/family/PendingInvitesList';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../hooks/use-toast';
import { logger } from '../shared/lib/logger';
import { 
  Users, 
  Mail, 
  Plus, 
  Settings, 
  BarChart3, 
  Shield, 
  User, 
  Eye,
  Crown,
  Home,
  Target
} from 'lucide-react';

export default function Familia() {
  const { data: familyData, isLoading, error } = useFamilyData();
  const createFamilyMutation = useCreateFamily();
  const { user } = useAuth();
  const { toast } = useToast();
  
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [showCreateFamilyModal, setShowCreateFamilyModal] = useState(false);
  const [familyName, setFamilyName] = useState('');
  const [familyDescription, setFamilyDescription] = useState('');

  const family = familyData?.family;
  const userRole = familyData?.user_role;
  const familyId = family?.id;

  // Debug logs para rastrear estado
  console.log('🎯 [DEBUG] Familia component render:', {
    isLoading,
    error: error?.message,
    familyData: familyData ? {
      family: familyData.family?.nome,
      userRole: familyData.user_role,
      memberCount: familyData.member_count
    } : null,
    createFamilyPending: createFamilyMutation.isPending
  });

  const handleCreateFamily = async (e: React.FormEvent) => {
    e.preventDefault();
    
    console.log('🎯 [DEBUG] handleCreateFamily iniciado');
    
    if (!familyName.trim()) {
      toast({
        title: 'Erro',
        description: 'Nome da família é obrigatório',
        variant: 'destructive',
      });
      return;
    }

    try {
      console.log('🎯 [DEBUG] Chamando mutateAsync...');
      await createFamilyMutation.mutateAsync({
        familyName: familyName.trim(),
        description: familyDescription.trim() || undefined
      });
      
      console.log('🎯 [DEBUG] mutateAsync concluído, limpando estado...');
      setFamilyName('');
      setFamilyDescription('');
      setShowCreateFamilyModal(false);
      
      console.log('🎯 [DEBUG] Estado limpo, aguardando rerender...');
      
      // Aguardar um pouco para garantir que as queries foram invalidadas
      setTimeout(() => {
        console.log('🎯 [DEBUG] Timeout concluído, estado atual:', {
          isLoading,
          isError,
          family: family?.nome,
          familyData: familyData?.family?.nome
        });
      }, 1000);
      
    } catch (error) {
        console.error('🎯 [DEBUG] Erro no handleCreateFamily:', error);
        logger.error('Erro ao criar família:', error);
      }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold">Família</h1>
        </div>
        
        <div className="grid gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Carregando...
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-20 bg-gray-200 rounded-lg animate-pulse"></div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold">Família</h1>
        </div>
        
        <Card>
          <CardContent className="text-center py-12">
            <Users className="h-16 w-16 mx-auto mb-4 text-gray-400" />
            <h3 className="text-lg font-semibold mb-2">Erro ao carregar dados da família</h3>
            <p className="text-muted-foreground mb-4">
              Ocorreu um erro ao carregar as informações da sua família.
            </p>
            <Button 
              variant="outline" 
              onClick={() => window.location.reload()}
            >
              Tentar novamente
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Se não tem família, mostrar opção para criar
  if (!family) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold">Família</h1>
        </div>
        
        <Card>
          <CardContent className="text-center py-12">
            <Users className="h-16 w-16 mx-auto mb-4 text-gray-400" />
            <h3 className="text-lg font-semibold mb-2">Ainda não tem uma família</h3>
            <p className="text-muted-foreground mb-6">
              Crie uma família para partilhar objetivos e gerir finanças em conjunto.
            </p>
            
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button 
                onClick={() => setShowCreateFamilyModal(true)}
                className="flex items-center gap-2"
              >
                <Plus className="h-4 w-4" />
                Criar Família
              </Button>
              
              <Button 
                variant="outline"
                onClick={() => toast({
                  title: 'Informação',
                  description: 'Para juntar-se a uma família existente, precisa de um convite.',
                })}
              >
                <Mail className="h-4 w-4 mr-2" />
                Juntar-se a uma Família
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Modal para criar família */}
        {showCreateFamilyModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4">
              <h3 className="text-lg font-semibold mb-4">Criar Nova Família</h3>
              
              <form onSubmit={handleCreateFamily} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-1">
                    Nome da Família *
                  </label>
                  <input
                    type="text"
                    value={familyName}
                    onChange={(e) => setFamilyName(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Ex: Família Silva"
                    required
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium mb-1">
                    Descrição (opcional)
                  </label>
                  <textarea
                    value={familyDescription}
                    onChange={(e) => setFamilyDescription(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Breve descrição da família..."
                    rows={3}
                  />
                </div>
                
                <div className="flex gap-2 justify-end">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setShowCreateFamilyModal(false);
                      setFamilyName('');
                      setFamilyDescription('');
                    }}
                  >
                    Cancelar
                  </Button>
                  <Button
                    type="submit"
                    disabled={createFamilyMutation.isPending}
                  >
                    {createFamilyMutation.isPending ? 'A criar...' : 'Criar Família'}
                  </Button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Família</h1>
          <p className="text-muted-foreground">
            {family.nome} • {userRole === 'admin' ? 'Administrador' : userRole === 'member' ? 'Membro' : 'Visualizador'}
          </p>
        </div>
        
        {userRole === 'admin' && (
          <Button 
            onClick={() => setShowInviteModal(true)}
            className="flex items-center gap-2"
          >
            <Mail className="h-4 w-4" />
            Convidar Membro
          </Button>
        )}
      </div>

      {/* Informações da Família */}
      <div className="grid gap-6 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Membros</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{familyData?.member_count || 0}</div>
            <p className="text-xs text-muted-foreground">
              Membros ativos na família
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Convites Pendentes</CardTitle>
            <Mail className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{familyData?.pending_invites_count || 0}</div>
            <p className="text-xs text-muted-foreground">
              Aguardando resposta
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Objetivos Partilhados</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{familyData?.shared_goals_count || 0}</div>
            <p className="text-xs text-muted-foreground">
              Objetivos em família
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs para diferentes secções */}
      <Tabs defaultValue="members" className="space-y-4">
        <TabsList>
          <TabsTrigger value="members" className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            Membros
          </TabsTrigger>
          <TabsTrigger value="invites" className="flex items-center gap-2">
            <Mail className="h-4 w-4" />
            Convites
          </TabsTrigger>
          {userRole === 'admin' && (
            <TabsTrigger value="settings" className="flex items-center gap-2">
              <Settings className="h-4 w-4" />
              Configurações
            </TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="members" className="space-y-4">
          <FamilyMembersList 
            familyId={familyId} 
            userRole={userRole} 
          />
        </TabsContent>

        <TabsContent value="invites" className="space-y-4">
          <PendingInvitesList 
            familyId={familyId} 
            userRole={userRole} 
          />
        </TabsContent>

        {userRole === 'admin' && (
          <TabsContent value="settings" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Settings className="h-5 w-5" />
                  Configurações da Família
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium mb-2">
                      Nome da Família
                    </label>
                    <input
                      type="text"
                      defaultValue={family.nome}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md"
                      disabled
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium mb-2">
                      Descrição
                    </label>
                    <textarea
                      defaultValue={family.descricao || ''}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md"
                      rows={3}
                      disabled
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium mb-2">
                      Criada em
                    </label>
                    <p className="text-sm text-muted-foreground">
                      {new Date(family.created_at).toLocaleDateString('pt-PT')}
                    </p>
                  </div>
                  
                  <Button variant="outline" disabled>
                    <Settings className="h-4 w-4 mr-2" />
                    Editar Configurações
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        )}
      </Tabs>

      {/* Modal de convite */}
      {showInviteModal && familyId && (
        <FamilyInviteModal
          isOpen={showInviteModal}
          onClose={() => setShowInviteModal(false)}
          familyId={familyId}
          familyName={family.nome}
        />
      )}
    </div>
  );
}