import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Plus, Edit, Trash2, Download, MapPin, TrendingUp, Euro, Search, Calendar } from 'lucide-react';
import { format } from 'date-fns';
import { pt } from 'date-fns/locale';
import { formatCurrency } from '@/lib/utils';
import { payrollService } from '../services/payrollService';

import { useActiveContract } from '../hooks/useActiveContract';
import { MileageTripForm } from '../components/MileageTripForm';
import { PayrollMileagePolicyForm } from '../components/PayrollMileagePolicyForm';
import { PayrollMileageTrip, PayrollMileagePolicy, MileagePolicyFormData } from '../types';
import { logger } from '@/shared/lib/logger';

const PayrollMileagePage: React.FC = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user, loading: authLoading } = useAuth();
  const { activeContract, loading: contractLoading } = useActiveContract();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [policies, setPolicies] = useState<PayrollMileagePolicy[]>([]);
  const [trips, setTrips] = useState<PayrollMileageTrip[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPolicy, setSelectedPolicy] = useState<PayrollMileagePolicy | null>(null);
  const [selectedTrip, setSelectedTrip] = useState<PayrollMileageTrip | null>(null);
  const [showPolicyForm, setShowPolicyForm] = useState(false);
  const [showTripForm, setShowTripForm] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });
  const [isImporting, setIsImporting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [editingTrip, setEditingTrip] = useState<PayrollMileageTrip | null>(null);
  
  // Carregar política e dados
  const loadData = useCallback(async () => {
    if (!user?.id || !activeContract?.id) return;
    
    setLoading(true);
    try {
      const [policiesData, tripsData] = await Promise.all([
        payrollService.getMileagePolicies(user.id, activeContract.id),
        payrollService.getMileageTrips(user.id, undefined, undefined, activeContract.id)
      ]);
      setPolicies(policiesData);
      setTrips(tripsData);
    } catch (error) {
      toast({
        title: 'Erro',
        description: 'Erro ao carregar dados de quilometragem.',
        variant: 'destructive'
      });
      logger.error('Error loading mileage data:', error);
    } finally {
      setLoading(false);
    }
  }, [user?.id, activeContract?.id, toast]);
  
  useEffect(() => {
    if (user && activeContract) {
      loadData();
    }
  }, [user, activeContract, loadData]);

  // Filtrar viagens por mês e termo de pesquisa
  const filteredTrips = trips.filter(trip => {
    const tripDate = new Date(trip.date);
    const [year, month] = selectedMonth.split('-');
    const tripMonth = `${tripDate.getFullYear()}-${String(tripDate.getMonth() + 1).padStart(2, '0')}`;
    
    const matchesMonth = tripMonth === selectedMonth;
    const matchesSearch = searchTerm === '' || 
      trip.origin.toLowerCase().includes(searchTerm.toLowerCase()) ||
      trip.destination.toLowerCase().includes(searchTerm.toLowerCase()) ||
      trip.purpose.toLowerCase().includes(searchTerm.toLowerCase());
    
    return matchesMonth && matchesSearch;
  });

  // Calcular estatísticas do mês
   const monthlyStats = {
     totalTrips: filteredTrips.length,
     totalKm: filteredTrips.reduce((sum, trip) => sum + trip.km, 0),
    totalAmount: filteredTrips.reduce((sum, trip) => {
      const policy = policies.find(p => p.id === trip.policy_id);
      return sum + (policy ? trip.km * (policy.rate_cents_per_km / 100) : 0);
    }, 0)
   };

   // Exportar dados para CSV
   const exportToCSV = () => {
     if (filteredTrips.length === 0) {
       toast({
         title: 'Aviso',
         description: 'Não há dados para exportar.',
         variant: 'default'
       });
       return;
     }

     const headers = ['Data', 'Origem', 'Destino', 'Propósito', 'Quilómetros', 'Taxa/km', 'Valor'];
     const csvContent = [
       headers.join(','),
       ...filteredTrips.map(trip => [
         trip.date,
         `"${trip.origin}"`,
         `"${trip.destination}"`,
         `"${trip.purpose}"`,
         trip.km,
         policies.find(p => p.id === trip.policy_id)?.rate_cents_per_km / 100 || 0,
         (() => {
           const policy = policies.find(p => p.id === trip.policy_id);
           return policy ? (trip.km * (policy.rate_cents_per_km / 100)).toFixed(2) : '0.00';
         })()
       ].join(','))
     ].join('\n');

     const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
     const link = document.createElement('a');
     const url = URL.createObjectURL(blob);
     link.setAttribute('href', url);
     link.setAttribute('download', `quilometragem_${selectedMonth}.csv`);
     link.style.visibility = 'hidden';
     document.body.appendChild(link);
     link.click();
     document.body.removeChild(link);

     toast({
       title: 'Sucesso',
       description: 'Dados exportados com sucesso.',
       variant: 'default'
     });
   };



  // Handlers para viagens
  const handleSaveTrip = async (tripData: Partial<PayrollMileageTrip>) => {
    if (!user) return;
    
    setIsSaving(true);
    try {
      // Se o formulário já persistiu e devolveu a entidade com id, evitar duplicar chamadas
      if ((tripData as PayrollMileageTrip)?.id) {
        const saved = tripData as PayrollMileageTrip;
        setTrips(prev => {
          const exists = prev.some(t => t.id === saved.id);
          return exists
            ? prev.map(t => (t.id === saved.id ? { ...t, ...saved } : t))
            : [saved, ...prev];
        });
        toast({
          title: 'Sucesso',
          description: selectedTrip ? 'Viagem atualizada com sucesso.' : 'Viagem criada com sucesso.',
          variant: 'default'
        });
      } else if (selectedTrip) {
        await payrollService.updateMileageTrip(selectedTrip.id, tripData);
        setTrips(prev => prev.map(t => (t.id === selectedTrip.id ? { ...t, ...tripData } as PayrollMileageTrip : t)));
        toast({
          title: 'Sucesso',
          description: 'Viagem atualizada com sucesso.',
          variant: 'default'
        });
      } else {
        const { policy_id, id, user_id, created_at, updated_at, ...cleanTripData } = tripData as PayrollMileageTrip;
        const newTrip = await payrollService.createMileageTrip(user.id, policy_id!, cleanTripData as any);
        setTrips(prev => [newTrip, ...prev]);
        toast({
          title: 'Sucesso',
          description: 'Viagem criada com sucesso.',
          variant: 'default'
        });
      }
      setShowTripForm(false);
      setSelectedTrip(null);
    } catch (error) {
      toast({
        title: 'Erro',
        description: 'Erro ao salvar viagem.',
        variant: 'destructive'
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteTrip = async (tripId: string) => {
    try {
      await payrollService.deleteMileageTrip(tripId);
      setTrips(prev => prev.filter(t => t.id !== tripId));
      toast({
        title: 'Sucesso',
        description: 'Viagem removida com sucesso.',
        variant: 'default'
      });
    } catch (error) {
      toast({
        title: 'Erro',
        description: 'Erro ao remover viagem.',
        variant: 'destructive'
      });
    }
  };

  // Handlers para políticas
  const handleSavePolicy = async (policyData: PayrollMileagePolicy) => {
    if (!user || !activeContract?.id) return;
    
    setIsSaving(true);
    try {
      if (selectedPolicy) {
        const formData: MileagePolicyFormData = {
          name: policyData.name,
          rate_per_km: policyData.rate_cents_per_km ? policyData.rate_cents_per_km / 100 : 0
        };
        const updatedPolicy = await payrollService.updateMileagePolicy(selectedPolicy.id, formData, user.id, activeContract.id);
        setPolicies(prev => prev.map(policy => 
          policy.id === selectedPolicy.id ? updatedPolicy : policy
        ));
        toast({
          title: 'Sucesso',
          description: 'Política atualizada com sucesso.',
          variant: 'default'
        });
      } else {
        const formData: MileagePolicyFormData = {
          name: policyData.name,
          rate_per_km: policyData.rate_cents_per_km ? policyData.rate_cents_per_km / 100 : 0
        };
        const newPolicy = await payrollService.createMileagePolicy(user.id, { ...formData, contract_id: activeContract.id });
        setPolicies(prev => [newPolicy, ...prev]);
        toast({
          title: 'Sucesso',
          description: 'Política criada com sucesso.',
          variant: 'default'
        });
      }
      setShowPolicyForm(false);
      setSelectedPolicy(null);
    } catch (error) {
      toast({
        title: 'Erro',
        description: 'Erro ao salvar política.',
        variant: 'destructive'
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeletePolicy = async (policyId: string) => {
    if (!user || !activeContract) return;
    
    try {
      await payrollService.deleteMileagePolicy(policyId, user.id, activeContract.id);
      setPolicies(prev => prev.filter(policy => policy.id !== policyId));
      toast({
        title: 'Sucesso',
        description: 'Política removida com sucesso.',
        variant: 'default'
      });
    } catch (error) {
      toast({
        title: 'Erro',
        description: 'Erro ao remover política.',
        variant: 'destructive'
      });
    }
  };

  if (authLoading || contractLoading || loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-gray-900"></div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <h2 className="text-2xl font-bold mb-4">Acesso Negado</h2>
          <p className="text-gray-600">Você precisa estar logado para acessar esta página.</p>
        </div>
      </div>
    );
  }

  if (!activeContract) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Alert>
          <AlertDescription>
            Nenhum contrato ativo encontrado. Por favor, configure um contrato ativo primeiro.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Quilometragem</h1>
          <p className="text-gray-600 mt-2">Gerir viagens e políticas de quilometragem</p>
        </div>
      </div>



      {/* Estatísticas do Mês */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Viagens do Mês</CardTitle>
            <MapPin className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{monthlyStats.totalTrips}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Quilómetros do Mês</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{monthlyStats.totalKm.toFixed(1)} km</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Valor do Mês</CardTitle>
            <Euro className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(monthlyStats.totalAmount, 'pt-PT', activeContract?.currency || 'EUR')}</div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="trips" className="space-y-6">
        <TabsList>
          <TabsTrigger value="trips">Viagens</TabsTrigger>
          <TabsTrigger value="policies">Políticas</TabsTrigger>
        </TabsList>

        <TabsContent value="trips" className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex justify-between items-center">
                <CardTitle>Viagens de Quilometragem</CardTitle>
                <div className="flex gap-2">
                  <Button
                    onClick={exportToCSV}
                    variant="outline"
                    size="sm"
                    disabled={filteredTrips.length === 0}
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Exportar CSV
                  </Button>
                  <Button
                    onClick={() => setShowTripForm(true)}
                    size="sm"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Nova Viagem
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Filtros */}
              <div className="flex gap-4">
                <div className="flex-1">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                    <Input
                      placeholder="Pesquisar viagens..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                </div>
                <div className="w-48">
                  <div className="relative">
                    <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                    <Input
                      type="month"
                      value={selectedMonth}
                      onChange={(e) => setSelectedMonth(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                </div>
              </div>

              {/* Lista de Viagens */}
              {filteredTrips.length === 0 ? (
                <div className="text-center py-8">
                  <MapPin className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-500 mb-4">
                    {searchTerm || selectedMonth !== `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}` 
                      ? 'Nenhuma viagem encontrada com os filtros aplicados.' 
                      : 'Nenhuma viagem registada ainda.'}
                  </p>
                  <Button onClick={() => setShowTripForm(true)}>
                    <Plus className="h-4 w-4 mr-2" />
                    Adicionar Primeira Viagem
                  </Button>
                </div>
              ) : (
                <div className="space-y-4">
                  {filteredTrips.map((trip) => (
                    <div key={trip.id} className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="flex-1">
                        <div className="flex items-center gap-4 mb-2">
                          <span className="font-medium">{new Date(trip.date).toLocaleDateString('pt-PT')}</span>
                          <span className="text-sm text-gray-500">{trip.km} km</span>
                        <span className="text-sm font-medium text-green-600">{(() => {
                          const policy = policies.find(p => p.id === trip.policy_id);
                          const amountCents = policy ? trip.km * policy.rate_cents_per_km : 0;
                          return formatCurrency(amountCents, 'pt-PT', activeContract?.currency || 'EUR');
                        })()}</span>
                        </div>
                        <div className="text-sm text-gray-600">
                          <span className="font-medium">De:</span> {trip.origin} → 
                          <span className="font-medium ml-2">Para:</span> {trip.destination}
                        </div>
                        <div className="text-sm text-gray-600 mt-1">
                          <span className="font-medium">Propósito:</span> {trip.purpose}
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setSelectedTrip(trip);
                            setShowTripForm(true);
                          }}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDeleteTrip(trip.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="policies" className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex justify-between items-center">
                <CardTitle>Políticas de Quilometragem</CardTitle>
                <Button
                  onClick={() => navigate('/personal/payroll/config')}
                  size="sm"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Nova Política
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {policies.length === 0 ? (
                <div className="text-center py-8">
                  <Alert className="mb-4">
                    <AlertDescription>
                      Nenhuma política de quilometragem configurada. Crie uma política para começar a registar viagens.
                    </AlertDescription>
                  </Alert>
                  <Button onClick={() => navigate('/personal/payroll/config')}>
                    <Plus className="h-4 w-4 mr-2" />
                    Criar Primeira Política
                  </Button>
                </div>
              ) : (
                <div className="space-y-4">
                  {policies.map((policy) => (
                    <div key={policy.id} className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="flex-1">
                        <div className="flex items-center gap-4 mb-2">
                          <span className="font-medium">{policy.name}</span>
                          <span className="text-sm font-medium text-green-600">{formatCurrency(policy.rate_cents_per_km, 'pt-PT', activeContract?.currency || 'EUR')}/km</span>
                        </div>

                        <div className="text-xs text-gray-500">
                          Criada em {new Date(policy.created_at).toLocaleDateString('pt-PT')}
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => navigate('/personal/payroll/config')}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDeletePolicy(policy.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Formulários em Dialog */}
      <Dialog open={showTripForm} onOpenChange={setShowTripForm}>
        <DialogContent className="max-w-2xl">
          <MileageTripForm
            trip={selectedTrip}
            policies={policies}
            onSave={handleSaveTrip}
            onCancel={() => {
              setShowTripForm(false);
              setSelectedTrip(null);
            }}
          />
        </DialogContent>
      </Dialog>

      <Dialog open={showPolicyForm} onOpenChange={setShowPolicyForm}>
        <DialogContent className="max-w-2xl">
          {activeContract?.id ? (
            <PayrollMileagePolicyForm
              policy={selectedPolicy}
              contractId={activeContract.id}
              onSave={handleSavePolicy}
              onCancel={() => {
                setShowPolicyForm(false);
                setSelectedPolicy(null);
              }}
            />
          ) : (
            <div className="p-4 text-center">
              <p>A carregar contrato...</p>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default PayrollMileagePage;