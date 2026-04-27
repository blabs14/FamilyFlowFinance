import React from 'react';
import { usePersonal } from './PersonalProvider';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { Lightbulb, TrendingUp, TrendingDown, Target, PiggyBank } from 'lucide-react';

const PersonalInsights: React.FC = () => {
  const { myTransactions, myGoals, personalKPIs } = usePersonal();

  // Calcular insights
  const currentMonth = new Date().toISOString().slice(0, 7);
  const monthlyTransactions = myTransactions.filter(t => t.data.startsWith(currentMonth));
  const monthlyIncome = monthlyTransactions
    .filter(t => t.tipo === 'receita')
    .reduce((sum, t) => sum + (t.amount_cents || 0) / 100, 0);
  const monthlyExpenses = monthlyTransactions
    .filter(t => t.tipo === 'despesa')
    .reduce((sum, t) => sum + (t.amount_cents || 0) / 100, 0);
  const savingsRate = monthlyIncome > 0 ? ((monthlyIncome - monthlyExpenses) / monthlyIncome) * 100 : 0;

  // Categorias mais gastas
  const expenseCategories = monthlyTransactions
    .filter(t => t.tipo === 'despesa')
    .reduce((acc, t) => {
      const category = t.categoria?.nome || 'Sem categoria';
      acc[category] = (acc[category] || 0) + (t.amount_cents || 0) / 100;
      return acc;
    }, {} as Record<string, number>);

  const topExpenseCategory = Object.entries(expenseCategories)
    .sort(([,a], [,b]) => (b as number) - (a as number))[0];

  return (
    <div className="p-6 space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Lightbulb className="h-5 w-5" />
            Insights Pessoais
          </CardTitle>
          <CardDescription>
            Análises e dicas para melhorar suas finanças pessoais
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Resumo Mensal */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-2">
                  <TrendingUp className="h-4 w-4 text-green-600" />
                  <span className="text-sm font-medium">Receitas</span>
                </div>
                <p className="text-2xl font-bold text-green-600">
                  {monthlyIncome.toFixed(2)}€
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-2">
                  <TrendingDown className="h-4 w-4 text-red-600" />
                  <span className="text-sm font-medium">Despesas</span>
                </div>
                <p className="text-2xl font-bold text-red-600">
                  {monthlyExpenses.toFixed(2)}€
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-2">
                  <PiggyBank className="h-4 w-4 text-blue-600" />
                  <span className="text-sm font-medium">Taxa Poupança</span>
                </div>
                <p className="text-2xl font-bold text-blue-600">
                  {savingsRate.toFixed(1)}%
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Dicas Personalizadas */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Dicas Personalizadas</h3>
            
            {savingsRate < 20 && (
              <Card className="border-yellow-200 bg-yellow-50">
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <Lightbulb className="h-5 w-5 text-yellow-600 mt-0.5" />
                    <div>
                      <h4 className="font-medium text-yellow-800">Aumente sua taxa de poupança</h4>
                      <p className="text-sm text-yellow-700 mt-1">
                        Sua taxa de poupança atual é de {savingsRate.toFixed(1)}%. 
                        Considere reduzir despesas desnecessárias para atingir pelo menos 20%.
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {personalKPIs.creditCardDebt > 0 && (
              <Card className="border-red-200 bg-red-50">
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <TrendingDown className="h-5 w-5 text-red-600 mt-0.5" />
                    <div>
                      <h4 className="font-medium text-red-800">Priorize o pagamento de dívidas</h4>
                      <p className="text-sm text-red-700 mt-1">
                        Você tem {personalKPIs.creditCardDebt.toFixed(2)}€ em dívidas de cartão de crédito. 
                        Considere pagar mais do que o mínimo para reduzir juros.
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {myGoals.length > 0 && personalKPIs.topGoalProgress < 50 && (
              <Card className="border-blue-200 bg-blue-50">
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <Target className="h-5 w-5 text-blue-600 mt-0.5" />
                    <div>
                      <h4 className="font-medium text-blue-800">Foque nos seus objetivos</h4>
                      <p className="text-sm text-blue-700 mt-1">
                        Seu objetivo principal está {personalKPIs.topGoalProgress.toFixed(0)}% completo. 
                        Considere aumentar as alocações mensais para atingir a meta mais rapidamente.
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {topExpenseCategory && (
              <Card className="border-orange-200 bg-orange-50">
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <TrendingDown className="h-5 w-5 text-orange-600 mt-0.5" />
                    <div>
                      <h4 className="font-medium text-orange-800">Categoria com maior gasto</h4>
                      <p className="text-sm text-orange-700 mt-1">
                                                 {topExpenseCategory[0]} representa {(topExpenseCategory[1] as number).toFixed(2)}€ 
                         das suas despesas este mês. Considere revisar este gasto.
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {savingsRate >= 30 && (
              <Card className="border-green-200 bg-green-50">
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <PiggyBank className="h-5 w-5 text-green-600 mt-0.5" />
                    <div>
                      <h4 className="font-medium text-green-800">Excelente taxa de poupança!</h4>
                      <p className="text-sm text-green-700 mt-1">
                        Parabéns! Sua taxa de poupança de {savingsRate.toFixed(1)}% está acima da média. 
                        Continue assim para construir um futuro financeiro sólido.
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Metas de Poupança */}
          <div>
            <h3 className="text-lg font-semibold mb-4">Metas de Poupança Recomendadas</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card>
                <CardContent className="p-4">
                  <h4 className="font-medium mb-2">Fundo de Emergência</h4>
                  <p className="text-sm text-muted-foreground mb-3">
                    Ideal ter 3-6 meses de despesas
                  </p>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 bg-gray-200 rounded-full h-2">
                      <div 
                        className="bg-blue-600 h-2 rounded-full" 
                        style={{ width: `${Math.min((personalKPIs.totalBalance / (monthlyExpenses * 3)) * 100, 100)}%` }}
                      />
                    </div>
                    <span className="text-sm font-medium">
                      {Math.min((personalKPIs.totalBalance / (monthlyExpenses * 3)) * 100, 100).toFixed(0)}%
                    </span>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-4">
                  <h4 className="font-medium mb-2">Taxa de Poupança</h4>
                  <p className="text-sm text-muted-foreground mb-3">
                    Meta: 20% do rendimento
                  </p>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 bg-gray-200 rounded-full h-2">
                      <div 
                        className="bg-green-600 h-2 rounded-full" 
                        style={{ width: `${Math.min(savingsRate, 100)}%` }}
                      />
                    </div>
                    <span className="text-sm font-medium">
                      {savingsRate.toFixed(0)}%
                    </span>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default PersonalInsights; 