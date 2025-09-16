import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from './ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from './ui/alert-dialog';
import { Badge } from './ui/badge';
import { Trash2, Plus, Edit, AlertTriangle } from 'lucide-react';
import { useCategoriesDomain } from '../hooks/useCategoriesQuery';
import { useDeleteCategory } from '../hooks/useCategoriesQuery';
import CategoryForm from './CategoryForm';
import { getCategoryIcon } from '../lib/utils';
import { notifySuccess, notifyError } from '../lib/notify';
import { LoadingSpinner } from './ui/loading-states';

interface CategoryManagementProps {
  className?: string;
}

export const CategoryManagement: React.FC<CategoryManagementProps> = ({ className }) => {
  const { data: categories, isLoading } = useCategoriesDomain();
  const deleteCategory = useDeleteCategory();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<any>(null);

  // Mostrar todas as categorias
  const allCategories = categories || [];

  const handleDeleteCategory = async (categoryId: string, categoryName: string) => {
    try {
      await deleteCategory.mutateAsync(categoryId);
      notifySuccess(`Categoria "${categoryName}" eliminada com sucesso`);
    } catch (error: any) {
      console.error('Erro ao eliminar categoria:', error);
      
      // Verificar se é erro de categoria em uso
      if (error?.message?.includes('ainda está em uso') || 
          error?.message?.includes('still in use') ||
          error?.code === '23503') {
        notifyError(`Não é possível eliminar a categoria "${categoryName}" porque ainda está a ser utilizada em transações ou orçamentos.`);
      } else if (error?.message?.includes('categoria padrão') || 
                 error?.message?.includes('default category')) {
        notifyError(`Não é possível eliminar a categoria "${categoryName}" porque é uma categoria padrão do sistema.`);
      } else {
        notifyError(`Erro ao eliminar categoria "${categoryName}". Tente novamente.`);
      }
    }
  };

  const handleCreateSuccess = () => {
    setIsCreateOpen(false);
    notifySuccess('Categoria criada com sucesso');
  };

  const handleEditSuccess = () => {
    setEditingCategory(null);
    notifySuccess('Categoria atualizada com sucesso');
  };

  if (isLoading) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle>Gestão de Categorias</CardTitle>
          <CardDescription>Gerir as suas categorias personalizadas</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex justify-center py-8">
            <LoadingSpinner />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          Gestão de Categorias
          <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="flex items-center gap-2">
                <Plus className="h-4 w-4" />
                Nova Categoria
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Criar Nova Categoria</DialogTitle>
                <DialogDescription>
                  Crie uma nova categoria personalizada para organizar as suas transações.
                </DialogDescription>
              </DialogHeader>
              <CategoryForm
                onSuccess={handleCreateSuccess}
                onCancel={() => setIsCreateOpen(false)}
              />
            </DialogContent>
          </Dialog>
        </CardTitle>
        <CardDescription>
          Gerir as suas categorias. Pode editar todas as categorias, mas apenas eliminar as que criou.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {allCategories.length === 0 ? (
          <div className="text-center py-8">
            <div className="text-muted-foreground mb-4">
              Não existem categorias disponíveis.
            </div>
            <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" className="flex items-center gap-2">
                  <Plus className="h-4 w-4" />
                  Criar Primeira Categoria
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Criar Nova Categoria</DialogTitle>
                  <DialogDescription>
                    Crie uma nova categoria personalizada para organizar as suas transações.
                  </DialogDescription>
                </DialogHeader>
                <CategoryForm
                  onSuccess={handleCreateSuccess}
                  onCancel={() => setIsCreateOpen(false)}
                />
              </DialogContent>
            </Dialog>
          </div>
        ) : (
          <div className="space-y-3">
            {allCategories.map((category) => {
              const IconComponent = getCategoryIcon(category.nome);
              
              return (
                <div
                  key={category.id}
                  className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div 
                      className="w-8 h-8 rounded-full flex items-center justify-center text-white"
                      style={{ backgroundColor: category.cor }}
                    >
                      <IconComponent className="h-4 w-4" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <div className="font-medium">{category.nome}</div>
                        <div className="flex gap-1">
                          {!category.user_id && (
                            <span className="px-2 py-1 text-xs rounded-full bg-gray-100 text-gray-600">
                              Sistema
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {category.user_id ? 'Categoria personalizada' : 'Categoria padrão do sistema'}
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <Dialog 
                      open={editingCategory?.id === category.id} 
                      onOpenChange={(open) => setEditingCategory(open ? category : null)}
                    >
                      <DialogTrigger asChild>
                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                          <Edit className="h-4 w-4" />
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Editar Categoria</DialogTitle>
                          <DialogDescription>
                            Editar os detalhes da categoria "{category.nome}".
                          </DialogDescription>
                        </DialogHeader>
                        <CategoryForm
                          initialData={category}
                          onSuccess={handleEditSuccess}
                          onCancel={() => setEditingCategory(null)}
                        />
                      </DialogContent>
                    </Dialog>

                    {category.user_id && (
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                            disabled={deleteCategory.isPending}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle className="flex items-center gap-2">
                              <AlertTriangle className="h-5 w-5 text-destructive" />
                              Eliminar Categoria
                            </AlertDialogTitle>
                            <AlertDialogDescription>
                              Tem a certeza que pretende eliminar a categoria <strong>"{category.nome}"</strong>?
                              <br /><br />
                              <div className="p-3 bg-destructive/10 rounded-lg border border-destructive/20">
                                <div className="text-sm text-destructive font-medium mb-1">
                                  ⚠️ Atenção:
                                </div>
                                <div className="text-sm text-muted-foreground">
                                  Esta ação não pode ser desfeita. Se esta categoria estiver a ser utilizada 
                                  em transações ou orçamentos, a eliminação será impedida.
                                </div>
                              </div>
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => handleDeleteCategory(category.id, category.nome)}
                              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                              disabled={deleteCategory.isPending}
                            >
                              {deleteCategory.isPending ? (
                                <>
                                  <LoadingSpinner className="mr-2 h-4 w-4" />
                                  A eliminar...
                                </>
                              ) : (
                                'Eliminar'
                              )}
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
};