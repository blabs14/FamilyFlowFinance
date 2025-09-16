import React, { useState, useEffect } from 'react';
import { Check, ChevronsUpDown, Plus } from 'lucide-react';
import { cn } from '../lib/utils';
import { Button } from './ui/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from './ui/command';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from './ui/popover';
import { useCategoriesDomain, useCreateCategory } from '../hooks/useCategoriesQuery';
import { useToast } from '../hooks/use-toast';
import { logger } from '@/shared/lib/logger';

interface CategorySelectProps {
  value?: string;
  onValueChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
}

export function CategorySelect({ value, onValueChange, placeholder = "Selecionar categoria...", disabled = false }: CategorySelectProps) {
  const [open, setOpen] = useState(false);
  const [searchValue, setSearchValue] = useState('');
  const { data: categories = [], isLoading } = useCategoriesDomain();
  const createCategoryMutation = useCreateCategory();
  const { toast } = useToast();

  // Debug temporário
  console.log('CategorySelect - categories:', categories);
  console.log('CategorySelect - isLoading:', isLoading);

  const selectedCategory = categories.find(category => category.id === value);

  const handleCreateCategory = async () => {
    if (!searchValue.trim()) return;

    try {
      const newCategory = await createCategoryMutation.mutateAsync({
        nome: searchValue.trim(),
        cor: '#3B82F6' // Cor padrão
      });

      toast({
        title: "Categoria criada",
        description: `A categoria "${searchValue.trim()}" foi criada com sucesso.`,
      });

      onValueChange(newCategory.id);
      setSearchValue('');
      setOpen(false);
    } catch (error: any) {
      logger.error('Erro ao criar categoria:', error);
      toast({
        title: "Erro",
        description: error.message || "Erro ao criar categoria.",
        variant: "destructive",
      });
    }
  };

  const handleSelect = (categoryId: string) => {
    onValueChange(categoryId);
    setOpen(false);
  };

  const filteredCategories = categories.filter(category =>
    category.nome.toLowerCase().includes(searchValue.toLowerCase())
  );

  const showCreateOption = searchValue.trim() && 
    !categories.some(cat => cat.nome.toLowerCase() === searchValue.toLowerCase());

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between"
          disabled={disabled}
        >
          {selectedCategory ? (
            <div className="flex items-center gap-2">
              <div 
                className="w-3 h-3 rounded-full" 
                style={{ backgroundColor: selectedCategory.cor || '#3B82F6' }}
              />
              {selectedCategory.nome}
            </div>
          ) : (
            placeholder
          )}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-full p-0" align="start">
        <Command>
          <CommandInput 
            placeholder="Procurar categoria..." 
            value={searchValue}
            onValueChange={setSearchValue}
          />
          <CommandList>
            <CommandEmpty>
              {showCreateOption ? (
                <div className="p-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full justify-start"
                    onClick={handleCreateCategory}
                    disabled={createCategoryMutation.isPending}
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    Criar "{searchValue.trim()}"
                  </Button>
                </div>
              ) : (
                <p className="p-2 text-sm text-muted-foreground">
                  Nenhuma categoria encontrada.
                </p>
              )}
            </CommandEmpty>
            <CommandGroup>
              {filteredCategories.map((category) => (
                <CommandItem
                  key={category.id}
                  value={category.id}
                  onSelect={() => handleSelect(category.id)}
                >
                  <div className="flex items-center gap-2 w-full">
                    <div 
                      className="w-3 h-3 rounded-full" 
                      style={{ backgroundColor: category.cor || '#3B82F6' }}
                    />
                    <span className="flex-1">{category.nome}</span>
                    <Check
                      className={cn(
                        "ml-auto h-4 w-4",
                        value === category.id ? "opacity-100" : "opacity-0"
                      )}
                    />
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}