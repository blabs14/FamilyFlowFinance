import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../ui/dialog';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import { FormSubmitButton } from '../ui/loading-button';
import { useCreateFamily } from '../../hooks/useFamilyQuery';
import { useToast } from '../../hooks/use-toast';
import { Users, Home } from 'lucide-react';
import { logger } from '@/shared/lib/logger';

interface CreateFamilyModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const CreateFamilyModal = ({ isOpen, onClose }: CreateFamilyModalProps) => {
  const [familyName, setFamilyName] = useState('');
  const [familyDescription, setFamilyDescription] = useState('');
  const [validationError, setValidationError] = useState('');
  
  const createFamilyMutation = useCreateFamily();
  const { toast } = useToast();

  const handleClose = () => {
    setFamilyName('');
    setFamilyDescription('');
    setValidationError('');
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError('');

    if (!familyName.trim()) {
      setValidationError('Nome da família é obrigatório');
      return;
    }

    if (familyName.trim().length < 2) {
      setValidationError('Nome da família deve ter pelo menos 2 caracteres');
      return;
    }

    try {
      logger.info('Creating family', { familyName: familyName.trim() });
      
      await createFamilyMutation.mutateAsync({
        familyName: familyName.trim(),
        description: familyDescription.trim() || undefined
      });

      toast({
        title: 'Sucesso',
        description: 'Família criada com sucesso!',
      });

      handleClose();
    } catch (error) {
      logger.error('Error creating family', { error });
      
      const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
      
      if (errorMessage.includes('duplicate') || errorMessage.includes('unique')) {
        setValidationError('Já existe uma família com este nome');
      } else {
        toast({
          title: 'Erro',
          description: 'Erro ao criar família. Tente novamente.',
          variant: 'destructive',
        });
      }
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Home className="h-5 w-5" />
            Criar Nova Família
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="familyName">Nome da Família *</Label>
            <Input
              id="familyName"
              type="text"
              value={familyName}
              onChange={(e) => setFamilyName(e.target.value)}
              placeholder="Ex: Família Silva"
              required
              disabled={createFamilyMutation.isPending}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="familyDescription">Descrição (opcional)</Label>
            <Textarea
              id="familyDescription"
              value={familyDescription}
              onChange={(e) => setFamilyDescription(e.target.value)}
              placeholder="Breve descrição da família..."
              rows={3}
              disabled={createFamilyMutation.isPending}
            />
          </div>

          {validationError && (
            <div className="text-sm text-destructive bg-destructive/10 p-3 rounded-md">
              {validationError}
            </div>
          )}

          <div className="bg-muted p-3 rounded-lg">
            <div className="flex items-center gap-2 mb-1">
              <Users className="h-4 w-4 text-blue-600" />
              <span className="font-medium">Administrador da Família</span>
            </div>
            <p className="text-sm text-muted-foreground">
              Será automaticamente definido como administrador da família, podendo gerir membros e configurações.
            </p>
          </div>

          <DialogFooter className="gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              disabled={createFamilyMutation.isPending}
            >
              Cancelar
            </Button>
            <FormSubmitButton
              isSubmitting={createFamilyMutation.isPending}
              submitText="Criar Família"
              submittingText="A criar..."
              className="min-w-[120px]"
            />
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};