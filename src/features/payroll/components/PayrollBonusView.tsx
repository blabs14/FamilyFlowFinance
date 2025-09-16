import React, { useState, useEffect } from 'react';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Gift,
  Settings,
  Calendar,
  Euro,
  TrendingUp,
  AlertCircle,
  CheckCircle,
  XCircle,
  Clock
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { formatCurrency } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { payrollService } from '../services/payrollService';
import { useToast } from '@/hooks/use-toast';
import { logger } from '@/shared/lib/logger';

interface PerformanceBonus {
  id: string;
  name: string;
  isActive: boolean;
  percentage: number;
  amount: number;
  frequency: string;
  nextPaymentDate: string;
  lastPaymentDate: string;
  description: string;
  legalInfo: string;
}

interface CustomBonus {
  id: string;
  name: string;
  amount: number;
  payment_frequency: string;
  next_payment_date: string;
  is_active: boolean;
  description?: string;
}

const mockPerformanceBonus: PerformanceBonus = {
  id: 'perf-001',
  name: 'Prémio de Produtividade',
  isActive: true,
  percentage: 4.5,
  amount: 2700,
  frequency: 'Trimestral',
  nextPaymentDate: '2025-03-31',
  lastPaymentDate: '2024-12-31',
  description: 'Prémio baseado em objetivos de produtividade (4.5% do salário base)',
  legalInfo: 'Isenção fiscal até 6% do salário base (máx. €4.350/ano)'
};

export function PayrollBonusView() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const [customBonuses, setCustomBonuses] = useState<CustomBonus[]>([]);
  const [performanceBonus, setPerformanceBonus] = useState<PerformanceBonus | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeContract, setActiveContract] = useState<any>(null);

  useEffect(() => {
    loadBonusData();
  }, [user]);

  const loadBonusData = async () => {
    if (!user?.id) return;

    try {
      setLoading(true);
      
      // Carregar contrato ativo
      const contract = await payrollService.getActiveContract(user.id);
      setActiveContract(contract);
      
      // Carregar bónus personalizados
      const bonuses = await payrollService.getCustomBonuses(user.id);
      setCustomBonuses(bonuses || []);
      
      // Para demonstração, usar dados mock para o prémio de produtividade
      if (contract) {
        setPerformanceBonus(mockPerformanceBonus);
      }
    } catch (error) {
      logger.error('Erro ao carregar dados de bónus:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível carregar os dados de bónus.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleToggleBonus = async (bonusId: string, isActive: boolean) => {
    try {
      await payrollService.updateCustomBonus(bonusId, { is_active: isActive });
      await loadBonusData();
      toast({
        title: 'Sucesso',
        description: `Bónus ${isActive ? 'ativado' : 'desativado'} com sucesso.`,
      });
    } catch (error) {
      logger.error('Erro ao atualizar bónus:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível atualizar o bónus.',
        variant: 'destructive',
      });
    }
  };

  const handleDeleteBonus = async (bonusId: string) => {
    try {
      await payrollService.deleteCustomBonus(bonusId);
      await loadBonusData();
      toast({
        title: 'Sucesso',
        description: 'Bónus removido com sucesso.',
      });
    } catch (error) {
      logger.error('Erro ao remover bónus:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível remover o bónus.',
        variant: 'destructive',
      });
    }
  };

  const activeBonuses = customBonuses.filter(bonus => bonus.is_active);
  const inactiveBonuses = customBonuses.filter(bonus => !bonus.is_active);

  const totalAnnualAmount = activeBonuses.reduce((total, bonus) => {
    const multiplier = bonus.payment_frequency === 'monthly' ? 12 : 
                      bonus.payment_frequency === 'quarterly' ? 4 : 
                      bonus.payment_frequency === 'biannual' ? 2 : 1;
    return total + (bonus.amount * multiplier);
  }, 0) + (performanceBonus?.isActive ? (performanceBonus.amount || 0) * 4 : 0);

  const formatCurrencyUtil = (amount: number) => {
    return formatCurrency(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('pt-PT');
  };

  const getFrequencyLabel = (frequency: string) => {
    const labels: Record<string, string> = {
      'monthly': 'Mensal',
      'quarterly': 'Trimestral',
      'biannual': 'Semestral',
      'annual': 'Anual'
    };
    return labels[frequency] || frequency;
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/3 mb-4"></div>
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-32 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Gift className="h-6 w-6 text-primary" />
              <div>
                <CardTitle>Bónus e Prémios Personalizados</CardTitle>
                <p className="text-sm text-muted-foreground mt-1">
                  {activeBonuses.length + (performanceBonus?.isActive ? 1 : 0)} configuração{(activeBonuses.length + (performanceBonus?.isActive ? 1 : 0)) !== 1 ? 'ões' : ''} ativa{(activeBonuses.length + (performanceBonus?.isActive ? 1 : 0)) !== 1 ? 's' : ''}
                </p>
              </div>
            </div>
            <Button 
              onClick={() => navigate('/personal/payroll/config')}
              className="flex items-center gap-2"
            >
              <Settings className="h-4 w-4" />
              Configurar
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="text-center p-4 bg-primary/5 rounded-lg">
              <div className="text-2xl font-bold text-primary">
                {formatCurrencyUtil(totalAnnualAmount)}
              </div>
              <div className="text-sm text-muted-foreground">Total Anual Estimado</div>
            </div>
            <div className="text-center p-4 bg-blue-50 rounded-lg">
              <div className="text-2xl font-bold text-blue-600">
                {activeBonuses.length}
              </div>
              <div className="text-sm text-muted-foreground">Bónus Personalizados</div>
            </div>
            <div className="text-center p-4 bg-green-50 rounded-lg">
              <div className="text-2xl font-bold text-green-600">
                {performanceBonus?.isActive ? '1' : '0'}
              </div>
              <div className="text-sm text-muted-foreground">Prémio de Produtividade</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {performanceBonus && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <TrendingUp className="h-5 w-5 text-green-600" />
                <div>
                  <CardTitle className="text-lg">{performanceBonus.name}</CardTitle>
                  <p className="text-sm text-muted-foreground">{performanceBonus.description}</p>
                </div>
              </div>
              <Badge variant={performanceBonus.isActive ? 'default' : 'secondary'}>
                {performanceBonus.isActive ? (
                  <><CheckCircle className="h-3 w-3 mr-1" />Ativo</>
                ) : (
                  <><XCircle className="h-3 w-3 mr-1" />Inativo</>
                )}
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="text-center p-3 bg-gray-50 rounded-lg">
                <div className="text-lg font-semibold text-gray-900">
                  {performanceBonus.percentage}%
                </div>
                <div className="text-xs text-gray-600">Percentagem</div>
              </div>
              <div className="text-center p-3 bg-gray-50 rounded-lg">
                <div className="text-lg font-semibold text-gray-900">
                  {formatCurrencyUtil(performanceBonus.amount)}
                </div>
                <div className="text-xs text-gray-600">Valor {performanceBonus.frequency}</div>
              </div>
              <div className="text-center p-3 bg-gray-50 rounded-lg">
                <div className="text-lg font-semibold text-gray-900">
                  <Calendar className="h-4 w-4 inline mr-1" />
                  {formatDate(performanceBonus.nextPaymentDate)}
                </div>
                <div className="text-xs text-gray-600">Próximo Pagamento</div>
              </div>
              <div className="text-center p-3 bg-gray-50 rounded-lg">
                <div className="text-lg font-semibold text-gray-900">
                  <Clock className="h-4 w-4 inline mr-1" />
                  {formatDate(performanceBonus.lastPaymentDate)}
                </div>
                <div className="text-xs text-gray-600">Último Pagamento</div>
              </div>
            </div>
            <div className="mt-4 p-3 bg-blue-50 rounded-lg">
              <p className="text-sm text-blue-800">
                <strong>Informação Legal:</strong> {performanceBonus.legalInfo}
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Lista de Bónus Personalizados</CardTitle>
        </CardHeader>
        <CardContent>
          {activeBonuses.length === 0 && inactiveBonuses.length === 0 ? (
            <div className="text-center py-8">
              <Gift className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">Nenhum bónus configurado</h3>
              <p className="text-gray-600 mb-4">Configure bónus personalizados para complementar o seu salário.</p>
              <Button onClick={() => navigate('/personal/payroll/config')}>
                <Settings className="h-4 w-4 mr-2" />
                Configurar Bónus
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              {activeBonuses.map((bonus) => (
                <Card key={bonus.id} className="border-l-4 border-l-green-500">
                  <CardContent className="pt-4">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <h4 className="font-medium">{bonus.name}</h4>
                          <Badge variant="default">
                            <CheckCircle className="h-3 w-3 mr-1" />
                            Ativo
                          </Badge>
                        </div>
                        {bonus.description && (
                          <p className="text-sm text-gray-600 mb-2">{bonus.description}</p>
                        )}
                        <div className="flex items-center gap-4 text-sm text-gray-600">
                          <span className="flex items-center gap-1">
                            <Euro className="h-4 w-4" />
                            {formatCurrencyUtil(bonus.amount)} ({getFrequencyLabel(bonus.payment_frequency)})
                          </span>
                          <span className="flex items-center gap-1">
                            <Calendar className="h-4 w-4" />
                            Próximo: {formatDate(bonus.next_payment_date)}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleToggleBonus(bonus.id, false)}
                        >
                          Desativar
                        </Button>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => handleDeleteBonus(bonus.id)}
                        >
                          Remover
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}

              {inactiveBonuses.map((bonus) => (
                <Card key={bonus.id} className="border-l-4 border-l-gray-300 opacity-60">
                  <CardContent className="pt-4">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <h4 className="font-medium">{bonus.name}</h4>
                          <Badge variant="secondary">
                            <XCircle className="h-3 w-3 mr-1" />
                            Inativo
                          </Badge>
                        </div>
                        {bonus.description && (
                          <p className="text-sm text-gray-600 mb-2">{bonus.description}</p>
                        )}
                        <div className="flex items-center gap-4 text-sm text-gray-600">
                          <span className="flex items-center gap-1">
                            <Euro className="h-4 w-4" />
                            {formatCurrencyUtil(bonus.amount)} ({getFrequencyLabel(bonus.payment_frequency)})
                          </span>
                          <span className="flex items-center gap-1">
                            <Calendar className="h-4 w-4" />
                            Próximo: {formatDate(bonus.next_payment_date)}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleToggleBonus(bonus.id, true)}
                        >
                          Ativar
                        </Button>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => handleDeleteBonus(bonus.id)}
                        >
                          Remover
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          <strong>Informação Legal:</strong> Os subsídios de férias e Natal são obrigatórios por lei. 
          Os prémios de produtividade têm benefícios fiscais até 6% do salário base (máximo €4.350/ano). 
          Consulte sempre um contabilista para validação fiscal.
        </AlertDescription>
      </Alert>
    </div>
  );
}

export default PayrollBonusView;