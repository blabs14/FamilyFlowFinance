import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Zap } from 'lucide-react';

interface Category { id: string; nome: string; }
interface Rule { id: string; pattern: string; }

interface Props {
  categoryId?: string | null;
  appliedRule?: Rule | null;
  categories: Category[];
  onChange: (categoryId: string) => void;
  onCreateRule: () => void;
}

export function CategoryCell({ categoryId, appliedRule, categories, onChange, onCreateRule }: Props) {
  return (
    <div className="flex items-center gap-1">
      <Select value={categoryId ?? ''} onValueChange={onChange}>
        <SelectTrigger className="h-7 text-xs w-36">
          <SelectValue placeholder="—" />
        </SelectTrigger>
        <SelectContent>
          {categories.map(c => (
            <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      {appliedRule && (
        <Zap className="h-3 w-3 text-blue-500" title={`Regra: ${appliedRule.pattern}`} />
      )}
      <Button variant="ghost" size="sm" className="text-xs text-muted-foreground h-7 px-1" onClick={onCreateRule}>
        + Regra
      </Button>
    </div>
  );
}
