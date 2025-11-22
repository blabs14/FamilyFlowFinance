import { useEffect, useState, useCallback, useMemo } from 'react';
import { getAccounts } from '../services/accounts';
import { getAccountAllocationsTotal } from '../services/goalAllocations';
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from './ui/table';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { useAuth } from '../contexts/AuthContext';
import { useFamily } from '../features/family/FamilyContext';
import { Input } from './ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Filter } from 'lucide-react';
import { formatCurrency } from '../lib/utils';
import { logger } from '@/shared/lib/logger';

export type Account = {
  id: string;
  nome: string;
  tipo: string;
  saldo?: number;
  created_at: string;
};

interface AccountListProps {
  onEdit: (account: Account) => void;
}

const AccountList = ({ onEdit }: AccountListProps) => {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [allocations, setAllocations] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();
  const { canEdit } = useFamily();

  // Filtros simples
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedType, setSelectedType] = useState('all');

  const fetchAccounts = useCallback(async () => {
    setLoading(true);
    const { data, error } = await getAccounts();
    if (!error && data) {
      setAccounts(data);
      
      // Buscar alocações para cada conta
      const allocationsData: Record<string, number> = {};
      for (const account of data) {
        try {
          const { data: total } = await getAccountAllocationsTotal(account.id, user?.id || '');
          allocationsData[account.id] = total ?? 0;
        } catch (error) {
          logger.error(`Erro ao buscar alocações da conta ${account.id}:`, error);
          allocationsData[account.id] = 0;
        }
      }
      setAllocations(allocationsData);
    }
    setLoading(false);
  }, [user?.id]);

  useEffect(() => {
    fetchAccounts();
  }, [user?.id, fetchAccounts]);

  // Atalho global '/' coberto por GlobalShortcuts



  const getAvailableBalance = (account: Account) => {
    const balance = account.saldo || 0;
    // Com dupla-entrada ativa nas alocações para objetivos, o saldo da conta de origem já reflecte a saída
    // Não subtrair novamente o valor reservado para evitar dupla subtração visual
    return balance;
  };

  const uniqueTypes = useMemo(() => {
    return Array.from(new Set(accounts.map(a => a.tipo))).filter(Boolean);
  }, [accounts]);

  const filteredAccounts = useMemo(() => {
    return accounts.filter(a => {
      const matchesSearch = !searchTerm || a.nome.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesType = selectedType === 'all' || a.tipo === selectedType;
      return matchesSearch && matchesType;
    });
  }, [accounts, searchTerm, selectedType]);

  return (
    <div className="space-y-3">
      {/* Filtros */}
      <div className="flex flex-col md:flex-row md:items-end gap-3">
        <div className="flex-1">
          <label className="text-sm font-medium">Pesquisar</label>
          <Input
            placeholder="Nome da conta..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            aria-describedby="accountlist-search-hint"
          />
          <div id="accountlist-search-hint" className="text-xs text-muted-foreground mt-1">
            Dica: pressione <kbd className="px-1 py-0.5 border rounded">/</kbd> para pesquisar
          </div>
        </div>
        <div className="w-full md:w-64">
          <label className="text-sm font-medium">Tipo</label>
          <Select value={selectedType} onValueChange={setSelectedType}>
            <SelectTrigger>
              <SelectValue placeholder="Todos os tipos" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os tipos</SelectItem>
              {uniqueTypes.map((t) => (
                <SelectItem key={t} value={t}>{t}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <label className="text-sm font-medium">&nbsp;</label>
          <Button
            variant="outline"
            className="w-full"
            onClick={() => { setSearchTerm(''); setSelectedType('all'); }}
          >
            <Filter className="h-4 w-4 mr-2" /> Limpar filtros
          </Button>
        </div>
      </div>
      {/* Badges de filtros ativos */}
      <div className="flex items-center gap-2 flex-wrap">
        {searchTerm && <Badge variant="secondary">Pesquisa: {searchTerm}</Badge>}
        {selectedType !== 'all' && <Badge variant="outline">Tipo: {selectedType}</Badge>}
      </div>

      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Saldo Total</TableHead>
              <TableHead>Reservado para Objetivos</TableHead>
              <TableHead>Saldo Disponível</TableHead>
              <TableHead>Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredAccounts.map((acc) => {
              const reserved = allocations[acc.id] || 0;
              const available = getAvailableBalance(acc);
              
              // Log temporário para validar valores após correções
              logger.debug('[AccountList] Conta:', {
                accountId: acc.id,
                nome: acc.nome,
                saldo: acc.saldo || 0,
                reserved,
                available
              });
              
              return (
                <TableRow key={acc.id}>
                  <TableCell className="font-medium">{acc.nome}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{acc.tipo}</Badge>
                  </TableCell>
                  <TableCell className="font-mono">
                    {formatCurrency(acc.saldo || 0, 'pt-PT', 'EUR')}
                  </TableCell>
                  <TableCell className="font-mono text-orange-600">
                    {reserved > 0 ? formatCurrency(reserved, 'pt-PT', 'EUR') : '-'}
                  </TableCell>
                  <TableCell className="font-mono">
                    <span className={available < 0 ? 'text-red-600' : 'text-green-600'}>
                      {formatCurrency(available, 'pt-PT', 'EUR')}
                    </span>
                  </TableCell>
                  <TableCell>
                    {canEdit('account') && (
                      <Button size="sm" variant="outline" onClick={() => onEdit(acc)}>
                        Editar
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
            {filteredAccounts.length === 0 && !loading && (
              <TableRow>
                <TableCell colSpan={6} className="text-center">Nenhuma conta encontrada.</TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
        {loading && <div className="text-center mt-2">A carregar...</div>}
      </div>
    </div>
  );
};

export default AccountList;