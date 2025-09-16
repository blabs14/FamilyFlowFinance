import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useFamily } from './FamilyContext';
import { Button } from '../../components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { Home, Plus } from 'lucide-react';
import { FamilyNotifications } from '../../components/family/FamilyNotifications';
import { CreateFamilyModal } from '../../components/family/CreateFamilyModal';
import { useUserFamilies } from '../../hooks/useFamilyQuery';

interface FamilyHeaderProps {
  showCreateFamilyButton?: boolean;
  onPrimaryAction?: () => void;
  primaryActionLabel?: string;
  primaryActionIcon?: React.ComponentType<{ className?: string }>;
}

const FamilyHeader: React.FC<FamilyHeaderProps> = ({
  showCreateFamilyButton = false,
  onPrimaryAction,
  primaryActionLabel,
  primaryActionIcon: PrimaryActionIcon = Plus
}) => {
  const location = useLocation();
  const { family, myRole, switchFamily } = useFamily();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const { data: userFamilies, isLoading: isLoadingFamilies } = useUserFamilies();

  const getPageTitle = () => {
    const path = location.pathname;
    if (path === '/family' || path === '/family/dashboard') return 'Dashboard';
    if (path === '/family/goals') return 'Objetivos';
    if (path === '/family/budgets') return 'Orçamentos';
    if (path === '/family/accounts') return 'Contas';
    if (path === '/family/transactions') return 'Transações';
    if (path === '/family/members') return 'Membros';
    if (path === '/family/settings') return 'Configurações';
    return 'Família';
  };

  const canPerformActions = myRole === 'owner' || myRole === 'admin' || myRole === 'member';

  return (
    <div className="flex items-center justify-between p-4 border-b bg-background">
      <div className="flex items-center gap-4">
        {/* Botão Voltar à Home */}
        <Link to="/app">
          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0"
            title="Voltar à Home"
          >
            <Home className="h-4 w-4" />
          </Button>
        </Link>

        {/* Título da Página */}
        <div>
          <h1 className="text-lg font-semibold">
            Família › {getPageTitle()}
          </h1>
          {family && (
            <p className="text-sm text-muted-foreground">
              {family.nome}
            </p>
          )}
        </div>
      </div>

      <div className="flex items-center gap-3">
        {/* Notificações da Família */}
        {family?.id && (
          <FamilyNotifications familyId={family.id} />
        )}

        {/* Seletor de Família */}
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Família:</span>
          <Select 
            value={family?.id || ''} 
            onValueChange={(familyId) => {
              if (familyId && switchFamily) {
                switchFamily(familyId);
              }
            }}
            disabled={isLoadingFamilies}
          >
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Selecionar família" />
            </SelectTrigger>
            <SelectContent>
              {userFamilies?.map((userFamily) => (
                <SelectItem key={userFamily.id} value={userFamily.id}>
                  {userFamily.nome}
                  {userFamily.id === family?.id && (
                    <span className="ml-2 text-xs text-muted-foreground">(atual)</span>
                  )}
                </SelectItem>
              ))}
              {(!userFamilies || userFamilies.length === 0) && (
                <SelectItem value="no-families" disabled>
                  Nenhuma família encontrada
                </SelectItem>
              )}
              
              {/* Separador e botão criar família */}
              {userFamilies && userFamilies.length > 0 && (
                <div className="border-t my-1" />
              )}
              <div className="p-1">
                <Button 
                  onClick={() => setShowCreateModal(true)} 
                  size="sm"
                  variant="ghost"
                  className="w-full justify-start h-8 px-2 py-1.5 text-sm"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Criar Nova Família
                </Button>
              </div>
            </SelectContent>
          </Select>
        </div>

        {/* Botão Criar Família */}
        {showCreateFamilyButton && (
          <Button 
            onClick={() => setShowCreateModal(true)} 
            size="sm"
            variant="outline"
          >
            <Plus className="h-4 w-4 mr-2" />
            Criar Família
          </Button>
        )}

        {/* Ação Primária */}
        {onPrimaryAction && canPerformActions && (
          <Button onClick={onPrimaryAction} size="sm">
            <PrimaryActionIcon className="h-4 w-4 mr-2" />
            {primaryActionLabel}
          </Button>
        )}
      </div>
      
      {/* Modal de Criar Família */}
      <CreateFamilyModal 
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
      />
    </div>
  );
};

export default FamilyHeader;