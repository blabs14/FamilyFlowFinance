import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

import { ConfirmationDialog } from '@/components/ui/confirmation-dialog';
import { Loader2, Settings, Users, Clock, Calendar, Plus, Edit, Trash2, CheckCircle, AlertTriangle, ChevronDown, ChevronRight, DollarSign, Clock4, Utensils, Plane, X } from 'lucide-react';
import { PayrollContract, PayrollOTPolicy, PayrollHoliday, PayrollVacation, PayrollMealAllowanceConfig as PayrollMealAllowanceConfigType, PayrollDeductionConfig, PayrollMileagePolicy } from '../types';
import { payrollService } from '../services/payrollService';
import { PayrollVacationsManager } from './PayrollVacationsManager';
import { PayrollMealAllowanceConfig } from './PayrollMealAllowanceConfig';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { useConfirmation } from '@/hooks/useConfirmation';
import { logger } from '@/shared/lib/logger';
import { formatCurrency } from '@/lib/utils';
import { calculateHourlyRate } from '../lib/calc';

export function PayrollSetupPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const confirmation = useConfirmation();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [contracts, setContracts] = useState<PayrollContract[]>([]);
  const [otPolicies, setOTPolicies] = useState<PayrollOTPolicy[]>([]);
  const [holidays, setHolidays] = useState<PayrollHoliday[]>([]);
  const [vacations, setVacations] = useState<PayrollVacation[]>([]);
  const [mealAllowanceConfig, setMealAllowanceConfig] = useState<PayrollMealAllowanceConfigType | null>(null);
  const [deductionConfigs, setDeductionConfigs] = useState<PayrollDeductionConfig[]>([]);
  const [mileagePolicies, setMileagePolicies] = useState<PayrollMileagePolicy[]>([]);
  const [expandedContracts, setExpandedContracts] = useState<Set<string>>(new Set());
  const [activeContract, setActiveContract] = useState<PayrollContract | null>(null);

  const [activeTab, setActiveTab] = useState('contracts');

  useEffect(() => {
    loadData();
  }, []);

  // Função para verificar se um contrato tem todas as configurações
  const getContractConfigStatus = (contractId: string) => {
    const hasOTPolicy = otPolicies.some(policy => policy.contract_id === contractId);
    const hasVacations = vacations.some(vacation => vacation.contract_id === contractId);
    const hasMealAllowance = mealAllowanceConfig && mealAllowanceConfig.contract_id === contractId;
    const hasDeductions = deductionConfigs.some(config => config.contract_id === contractId);
    const hasMileage = mileagePolicies.some(policy => policy.contract_id === contractId);
    
    const completedConfigs = [hasOTPolicy, hasVacations, hasMealAllowance, hasDeductions, hasMileage].filter(Boolean).length;
    const totalConfigs = 5;
    
    return {
      hasOTPolicy,
      hasVacations,
      hasMealAllowance,
      hasDeductions,
      hasMileage,
      completedConfigs,
      totalConfigs,
      isComplete: completedConfigs === totalConfigs
    };
  };

  // Função para obter detalhes das configurações de um contrato
  const getContractConfigDetails = (contractId: string) => {
    const otPolicy = otPolicies.find(policy => policy.contract_id === contractId);
    const vacation = vacations.find(vacation => vacation.contract_id === contractId);
    const mealAllowance = mealAllowanceConfig && mealAllowanceConfig.contract_id === contractId ? mealAllowanceConfig : null;
    const deduction = deductionConfigs.find(config => config.contract_id === contractId);
    const mileagePolicy = mileagePolicies.find(policy => policy.contract_id === contractId);
    
    return {
      otPolicy,
      vacation,
      mealAllowance,
      deduction,
      mileagePolicy
    };
  };

  // Função para alternar expansão de contrato
  const toggleContractExpansion = (contractId: string) => {
    const newExpanded = new Set(expandedContracts);
    if (newExpanded.has(contractId)) {
      newExpanded.delete(contractId);
    } else {
      newExpanded.add(contractId);
    }
    setExpandedContracts(newExpanded);
  };

  const loadData = async () => {
    if (!user?.id) return;
    
    setLoading(true);
    try {
      // Primeiro, carregar dados básicos
      const [contractsData, otPoliciesData, holidaysData, vacationsData, activeContract, deductionConfigsData] = await Promise.all([
        payrollService.getContracts(user.id),
        payrollService.getOTPolicies(user.id),
        payrollService.getHolidays(user.id, new Date().getFullYear(), undefined, undefined),
        payrollService.getVacations(user.id, undefined, new Date().getFullYear()),
        payrollService.getActiveContract(user.id),
        payrollService.getDeductionConfigs(user.id)
      ]);
      
      // Após obter activeContract, recarregar feriados com o contexto correto
      const holidaysWithContext = await payrollService.getHolidays(
        user.id,
        new Date().getFullYear(),
        activeContract?.id,
        activeContract?.workplace_location
      );
      setHolidays(holidaysWithContext);
      setContracts(contractsData);
      setOTPolicies(otPoliciesData);
      setHolidays(holidaysData);
      setVacations(vacationsData);
      setDeductionConfigs(deductionConfigsData);
      setActiveContract(activeContract);

      // Depois, carregar dados que dependem do activeContract
      const [mileagePoliciesData, mealConfigData] = await Promise.all([
        activeContract?.id ? payrollService.getMileagePolicies(user.id, activeContract.id) : Promise.resolve([]),
        activeContract?.id ? payrollService.getMealAllowanceConfig(user.id, activeContract.id) : Promise.resolve(null)
      ]);
      
      setMileagePolicies(mileagePoliciesData);
      setMealAllowanceConfig(mealConfigData);
    } catch (error) {
      toast({
        title: 'Erro',
        description: 'Erro ao carregar dados de configuração.',
        variant: 'destructive'
      });
      logger.error('Error loading payroll data:', error);
    } finally {
      setLoading(false);
    }
  };



  const handleDeleteContract = (contract: PayrollContract) => {
    confirmation.confirm(
      {
        title: 'Eliminar Contrato',
        message: `Tem a certeza que deseja eliminar o contrato "${contract.name}"? Esta ação não pode ser desfeita.`,
        confirmText: 'Eliminar',
        cancelText: 'Cancelar',
        variant: 'destructive',
      },
      async () => {
        setLoading(true);
        try {
          if (!user?.id) {
            toast({
              title: 'Erro',
              description: 'Utilizador não autenticado.',
              variant: 'destructive'
            });
            return;
          }
          await payrollService.deleteContract(contract.id, user.id);
          toast({
            title: 'Contrato eliminado',
            description: 'O contrato foi eliminado com sucesso.'
          });
          await loadData();
        } catch (error) {
          toast({
            title: 'Erro',
            description: 'Erro ao eliminar contrato.',
            variant: 'destructive'
          });
          logger.error('Error deleting contract:', error);
        } finally {
          setLoading(false);
        }
      }
    );
  };

  const handleDeleteOTPolicy = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir esta política?')) return;

    setLoading(true);
    try {
      await payrollService.deleteOTPolicy(id, user?.id, activeContract?.id);
      toast({
        title: 'Política excluída',
        description: 'A política foi excluída com sucesso.'
      });
      await loadData();
    } catch (error) {
      toast({
        title: 'Erro',
        description: 'Erro ao excluir política.',
        variant: 'destructive'
      });
      logger.error('Error deleting OT policy:', error);
    } finally {
      setLoading(false);
    }
  };



  const getSetupStatus = () => {
    const hasContracts = contracts.length > 0;
    const hasActivePolicies = otPolicies.some(p => p.is_active);
    const hasHolidays = holidays.length > 0;
    
    const completedSteps = [hasContracts, hasActivePolicies, hasHolidays].filter(Boolean).length;
    const totalSteps = 3;
    
    return {
      isComplete: completedSteps === totalSteps,
      completedSteps,
      totalSteps,
      hasContracts,
      hasActivePolicies,
      hasHolidays
    };
  };

  const status = getSetupStatus();

  if (loading && contracts.length === 0) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin" />
        <span className="ml-2 text-lg">Carregando configurações...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header com Status */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Settings className="h-6 w-6" />
                Configuração da Folha de Pagamento
              </CardTitle>
              <CardDescription>
                Configure contratos, políticas de horas extras e feriados para o cálculo automático da folha de pagamento.
              </CardDescription>
            </div>
            <div className="text-right">
              <div className="flex items-center gap-2 mb-2">
                {status.isComplete ? (
                  <CheckCircle className="h-5 w-5 text-green-500" />
                ) : (
                  <AlertTriangle className="h-5 w-5 text-amber-500" />
                )}
                <span className="font-medium">
                  {status.completedSteps}/{status.totalSteps} Configurações
                </span>
              </div>
              <Badge variant={status.isComplete ? 'default' : 'secondary'}>
                {status.isComplete ? 'Configuração Completa' : 'Configuração Pendente'}
              </Badge>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Status das Configurações */}
      {!status.isComplete && (
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            <div className="space-y-1">
              <p className="font-medium">Configurações pendentes:</p>
              <ul className="list-disc list-inside text-sm space-y-1">
                {!status.hasContracts && <li>Criar pelo menos um contrato de trabalho</li>}
                {!status.hasActivePolicies && <li>Configurar políticas de horas extras</li>}
                {!status.hasHolidays && <li>Adicionar feriados do ano atual</li>}
              </ul>
            </div>
          </AlertDescription>
        </Alert>
      )}

      {/* Tabs de Configuração */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="contracts" className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            Contratos ({contracts.length})
          </TabsTrigger>
          <TabsTrigger value="policies" className="flex items-center gap-2">
            <Clock className="h-4 w-4" />
            Políticas HE ({otPolicies.length})
          </TabsTrigger>
          <TabsTrigger value="vacations" className="flex items-center gap-2">
            <Calendar className="h-4 w-4" />
            Férias ({vacations.length})
          </TabsTrigger>
          <TabsTrigger value="meal-allowance" className="flex items-center gap-2">
            <Settings className="h-4 w-4" />
            Subsídios
          </TabsTrigger>
        </TabsList>

        {/* Tab: Contratos */}
        <TabsContent value="contracts">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Contratos de Trabalho</CardTitle>
                  <CardDescription>
                    Visualize e gerencie os contratos de trabalho dos funcionários.
                  </CardDescription>
                </div>
                <Button onClick={() => navigate('/personal/payroll/config')}>
                  <Plus className="mr-2 h-4 w-4" />
                  Novo Contrato
                </Button>
              </div>
            </CardHeader>

            <CardContent>
              {contracts.length === 0 ? (
                <Alert>
                  <Users className="h-4 w-4" />
                  <AlertDescription>
                    <span>Nenhum contrato configurado. Use o seletor de contratos para criar um novo.</span>
                  </AlertDescription>
                </Alert>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[50px]"></TableHead>
                      <TableHead>Funcionário</TableHead>
                      <TableHead>Salário Base</TableHead>
                      <TableHead>Taxa Horária</TableHead>
                      <TableHead className="text-center">Horas Extra</TableHead>
                      <TableHead className="text-center">Férias</TableHead>
                      <TableHead className="text-center">Subsídio Alimentação</TableHead>
                      <TableHead className="text-center">Deduções</TableHead>
                      <TableHead className="text-center">Quilometragem</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="w-[100px]">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {contracts.map((contract) => {
                      const configStatus = getContractConfigStatus(contract.id);
                      const isExpanded = expandedContracts.has(contract.id);
                      
                      return (
                        <React.Fragment key={contract.id}>
                          <TableRow>
                            <TableCell>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => toggleContractExpansion(contract.id)}
                                className="p-0 h-8 w-8"
                              >
                                {isExpanded ? (
                                  <ChevronDown className="h-4 w-4" />
                                ) : (
                                  <ChevronRight className="h-4 w-4" />
                                )}
                              </Button>
                            </TableCell>
                            <TableCell className="font-medium">{contract.name}</TableCell>
                            <TableCell>{formatCurrency(contract.base_salary_cents, 'pt-PT', contract.currency || 'EUR')}</TableCell>
                            <TableCell>
                              {(() => {
                                const hourlyRate = calculateHourlyRate(contract.base_salary_cents, contract.schedule_json || {});
                                return hourlyRate > 0 ? formatCurrency(hourlyRate, 'pt-PT', contract.currency || 'EUR') : '-';
                              })()}
                            </TableCell>
                            {/* Horas Extra */}
                            <TableCell className="text-center">
                              {(() => {
                                const details = getContractConfigDetails(contract.id);
                                return details.overtimePolicy ? (
                                  <CheckCircle className="h-4 w-4 text-green-500 mx-auto" />
                                ) : (
                                  <X className="h-4 w-4 text-red-500 mx-auto" />
                                );
                              })()} 
                            </TableCell>
                            {/* Férias */}
                            <TableCell className="text-center">
                              {(() => {
                                const details = getContractConfigDetails(contract.id);
                                return details.vacationPolicy ? (
                                  <CheckCircle className="h-4 w-4 text-green-500 mx-auto" />
                                ) : (
                                  <X className="h-4 w-4 text-red-500 mx-auto" />
                                );
                              })()} 
                            </TableCell>
                            {/* Subsídio Alimentação */}
                            <TableCell className="text-center">
                              {(() => {
                                const details = getContractConfigDetails(contract.id);
                                return details.mealAllowanceConfig ? (
                                  <CheckCircle className="h-4 w-4 text-green-500 mx-auto" />
                                ) : (
                                  <X className="h-4 w-4 text-red-500 mx-auto" />
                                );
                              })()} 
                            </TableCell>
                            {/* Deduções */}
                            <TableCell className="text-center">
                              {(() => {
                                const details = getContractConfigDetails(contract.id);
                                return details.deduction ? (
                                  <CheckCircle className="h-4 w-4 text-green-500 mx-auto" />
                                ) : (
                                  <X className="h-4 w-4 text-red-500 mx-auto" />
                                );
                              })()} 
                            </TableCell>
                            {/* Quilometragem */}
                            <TableCell className="text-center">
                              {(() => {
                                const details = getContractConfigDetails(contract.id);
                                return details.mileagePolicy ? (
                                  <CheckCircle className="h-4 w-4 text-green-500 mx-auto" />
                                ) : (
                                  <X className="h-4 w-4 text-red-500 mx-auto" />
                                );
                              })()} 
                            </TableCell>
                            <TableCell>
                              <Badge variant={contract.is_active ? 'default' : 'secondary'}>
                                {contract.is_active ? 'Ativo' : 'Inativo'}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <div className="flex space-x-1">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => navigate('/personal/payroll/config')}
                                >
                                  <Edit className="h-3 w-3" />
                                </Button>
                                <Button
                                   size="sm"
                                   variant="outline"
                                   onClick={() => handleDeleteContract(contract)}
                                 >
                                   <Trash2 className="h-3 w-3" />
                                 </Button>
                               </div>
                             </TableCell>
                           </TableRow>
                           
                           {/* Linha expansível com detalhes das configurações */}
                           {isExpanded && (
                             <TableRow key={`expanded-${contract.id}`}>
                               <TableCell colSpan={11} className="bg-gray-50 p-4">
                                 <div className="space-y-4">
                                   <h4 className="font-semibold text-sm mb-3">Configurações do Contrato</h4>
                                   
                                   <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                     {/* Horas Extra */}
                                     <div className="p-4 border rounded-lg bg-white">
                                       <div className="flex items-center gap-2 mb-2">
                                         <Clock4 className="h-4 w-4 text-blue-500" />
                                         <span className="font-medium text-sm">Horas Extra</span>
                                         {configStatus.hasOTPolicy ? (
                                           <Badge variant="default" className="text-xs ml-auto">
                                             <CheckCircle className="h-3 w-3 mr-1" />
                                             Configurado
                                           </Badge>
                                         ) : (
                                           <Badge variant="secondary" className="text-xs ml-auto">
                                             <AlertTriangle className="h-3 w-3 mr-1" />
                                             Pendente
                                           </Badge>
                                         )}
                                       </div>
                                       {(() => {
                                         const configDetails = getContractConfigDetails(contract.id);
                                         return configDetails.otPolicy ? (
                                           <div className="text-xs text-gray-600 space-y-1">
                                             <div>Taxa Normal: {configDetails.otPolicy.normal_rate}x</div>
                                             <div>Taxa Feriados: {configDetails.otPolicy.holiday_rate}x</div>
                                             <div>Taxa Fins de Semana: {configDetails.otPolicy.weekend_rate}x</div>
                                           </div>
                                         ) : (
                                           <div className="text-xs text-gray-500">Nenhuma política configurada</div>
                                         );
                                       })()}
                                     </div>
                                     
                                     {/* Férias */}
                                     <div className="p-4 border rounded-lg bg-white">
                                       <div className="flex items-center gap-2 mb-2">
                                         <Plane className="h-4 w-4 text-green-500" />
                                         <span className="font-medium text-sm">Férias</span>
                                         {configStatus.hasVacations ? (
                                           <Badge variant="default" className="text-xs ml-auto">
                                             <CheckCircle className="h-3 w-3 mr-1" />
                                             Configurado
                                           </Badge>
                                         ) : (
                                           <Badge variant="secondary" className="text-xs ml-auto">
                                             <AlertTriangle className="h-3 w-3 mr-1" />
                                             Pendente
                                           </Badge>
                                         )}
                                       </div>
                                       {(() => {
                                         const configDetails = getContractConfigDetails(contract.id);
                                         return configDetails.vacation ? (
                                           <div className="text-xs text-gray-600 space-y-1">
                                             <div>Dias Disponíveis: {configDetails.vacation.days_available}</div>
                                             <div>Dias Usados: {configDetails.vacation.days_used}</div>
                                             <div>Ano: {configDetails.vacation.year}</div>
                                           </div>
                                         ) : (
                                           <div className="text-xs text-gray-500">Nenhuma configuração de férias</div>
                                         );
                                       })()}
                                     </div>
                                     
                                     {/* Subsídio de Alimentação */}
                                     <div className="p-4 border rounded-lg bg-white">
                                       <div className="flex items-center gap-2 mb-2">
                                         <Utensils className="h-4 w-4 text-orange-500" />
                                         <span className="font-medium text-sm">Subsídio Alimentação</span>
                                         {configStatus.hasMealAllowance ? (
                                           <Badge variant="default" className="text-xs ml-auto">
                                             <CheckCircle className="h-3 w-3 mr-1" />
                                             Configurado
                                           </Badge>
                                         ) : (
                                           <Badge variant="secondary" className="text-xs ml-auto">
                                             <AlertTriangle className="h-3 w-3 mr-1" />
                                             Pendente
                                           </Badge>
                                         )}
                                       </div>
                                       {(() => {
                                         const configDetails = getContractConfigDetails(contract.id);
                                         return configDetails.mealAllowance ? (
                                           <div className="text-xs text-gray-600 space-y-1">
                                             <div>Valor Diário: €{configDetails.mealAllowance.daily_amount}</div>
                                             <div>Dias por Mês: {configDetails.mealAllowance.days_per_month}</div>
                                             <div>Ativo: {configDetails.mealAllowance.is_active ? 'Sim' : 'Não'}</div>
                                           </div>
                                         ) : (
                                           <div className="text-xs text-gray-500">Nenhuma configuração de subsídio</div>
                                         );
                                       })()}
                                     </div>
                                     
                                     {/* Deduções */}
                                     <div className="p-4 border rounded-lg bg-white">
                                       <div className="flex items-center gap-2 mb-2">
                                         <DollarSign className="h-4 w-4 text-red-500" />
                                         <span className="font-medium text-sm">Deduções</span>
                                         {configStatus.hasDeductions ? (
                                           <Badge variant="default" className="text-xs ml-auto">
                                             <CheckCircle className="h-3 w-3 mr-1" />
                                             Configurado
                                           </Badge>
                                         ) : (
                                           <Badge variant="secondary" className="text-xs ml-auto">
                                             <AlertTriangle className="h-3 w-3 mr-1" />
                                             Pendente
                                           </Badge>
                                         )}
                                       </div>
                                       {(() => {
                                         const configDetails = getContractConfigDetails(contract.id);
                                         return configDetails.deduction ? (
                                           <div className="text-xs text-gray-600 space-y-1">
                                             <div>Tipo: {configDetails.deduction.deduction_type}</div>
                                             <div>Valor: €{configDetails.deduction.amount}</div>
                                             <div>Descrição: {configDetails.deduction.description}</div>
                                           </div>
                                         ) : (
                                           <div className="text-xs text-gray-500">Nenhuma dedução configurada</div>
                                         );
                                       })()}
                                     </div>
                                     
                                     {/* Quilometragem */}
                                     <div className="p-4 border rounded-lg bg-white">
                                       <div className="flex items-center gap-2 mb-2">
                                         <Settings className="h-4 w-4 text-purple-500" />
                                         <span className="font-medium text-sm">Quilometragem</span>
                                         {configStatus.hasMileage ? (
                                           <Badge variant="default" className="text-xs ml-auto">
                                             <CheckCircle className="h-3 w-3 mr-1" />
                                             Configurado
                                           </Badge>
                                         ) : (
                                           <Badge variant="secondary" className="text-xs ml-auto">
                                             <AlertTriangle className="h-3 w-3 mr-1" />
                                             Pendente
                                           </Badge>
                                         )}
                                       </div>
                                       {(() => {
                                         const configDetails = getContractConfigDetails(contract.id);
                                         return configDetails.mileagePolicy ? (
                                           <div className="text-xs text-gray-600 space-y-1">
                                             <div>Taxa por Km: €{configDetails.mileagePolicy.rate_per_km}</div>
                                             <div>Limite Mensal: {configDetails.mileagePolicy.monthly_limit} km</div>
                                             <div>Ativo: {configDetails.mileagePolicy.is_active ? 'Sim' : 'Não'}</div>
                                           </div>
                                         ) : (
                                           <div className="text-xs text-gray-500">Nenhuma política de quilometragem</div>
                                         );
                                       })()}
                                     </div>
                                   </div>
                                 
                                   <div className="flex justify-end pt-2">
                                     <Button
                                       size="sm"
                                       onClick={() => navigate('/personal/payroll/config')}
                                       className="text-xs"
                                     >
                                       <Settings className="h-3 w-3 mr-1" />
                                       Configurar
                                     </Button>
                                   </div>
                                 </div>
                               </TableCell>
                             </TableRow>
                           )}
                         </React.Fragment>
                       );
                     })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab: Políticas de Horas Extras */}
        <TabsContent value="policies">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Políticas de Horas Extras</CardTitle>
                  <CardDescription>
                    Configure as regras para cálculo de horas extras, incluindo multiplicadores e limites.
                  </CardDescription>
                </div>
                <Button onClick={() => navigate('/personal/payroll/config')}>
                  <Plus className="mr-2 h-4 w-4" />
                  Nova Política
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {otPolicies.length === 0 ? (
                <Alert>
                  <Clock className="h-4 w-4" />
                  <AlertDescription className="flex items-center justify-between">
                    <span>Nenhuma política de horas extras configurada. Crie políticas para automatizar o cálculo de HE.</span>
                    <Button 
                      size="sm" 
                      onClick={() => navigate('/personal/payroll/config')}
                      className="ml-4"
                    >
                      <Plus className="mr-2 h-3 w-3" />
                      Criar Primeira Política
                    </Button>
                  </AlertDescription>
                </Alert>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nome</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Multiplicador</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="w-[100px]">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {otPolicies.map((policy) => (
                      <TableRow key={policy.id}>
                        <TableCell className="font-medium">{policy.name}</TableCell>
                        <TableCell className="capitalize">{policy.ot_type}</TableCell>
                        <TableCell>{policy.multiplier}x</TableCell>
                        <TableCell>
                          <Badge variant={policy.is_active ? 'default' : 'secondary'}>
                            {policy.is_active ? 'Ativa' : 'Inativa'}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex space-x-1">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => navigate('/personal/payroll/config')}
                            >
                              <Edit className="h-3 w-3" />
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleDeleteOTPolicy(policy.id)}
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab: Férias */}
        <TabsContent value="vacations">
          {activeContract ? (
            <PayrollVacationsManager 
              contractId={activeContract.id}
              year={new Date().getFullYear()}
              vacations={vacations}
              onVacationsChange={setVacations}
            />
          ) : (
            <Card>
              <CardContent className="p-6">
                <p className="text-muted-foreground">Selecione um contrato ativo para gerir férias.</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Tab: Subsídio de Alimentação */}
        <TabsContent value="meal-allowance">
          <PayrollMealAllowanceConfig 
            config={mealAllowanceConfig}
            onConfigChange={setMealAllowanceConfig}
          />
        </TabsContent>
      </Tabs>

      {/* Confirmation Dialog */}
      <ConfirmationDialog
        isOpen={confirmation.isOpen}
        onClose={confirmation.close}
        onConfirm={confirmation.onConfirm}
        onCancel={confirmation.onCancel}
        title={confirmation.options.title}
        message={confirmation.options.message}
        confirmText={confirmation.options.confirmText}
        cancelText={confirmation.options.cancelText}
        variant={confirmation.options.variant}
      />
    </div>
  );
}