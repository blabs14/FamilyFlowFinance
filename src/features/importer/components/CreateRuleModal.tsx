import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useState } from 'react';
import { createRule } from '@/services/importer';
import { useAuth } from '@/contexts/AuthContext';

interface Category { id: string; nome: string; }
interface Props {
  open: boolean;
  onClose: () => void;
  prefillPattern?: string;
  prefillCategoryId?: string;
  categories: Category[];
}

export function CreateRuleModal({ open, onClose, prefillPattern, prefillCategoryId, categories }: Props) {
  const { user } = useAuth();
  const [pattern, setPattern]       = useState(prefillPattern ?? '');
  const [categoryId, setCategoryId] = useState(prefillCategoryId ?? '');
  const [saving, setSaving]         = useState(false);

  async function handleSave() {
    if (!pattern || !categoryId) return;
    setSaving(true);
    await createRule({
      user_id: user!.id,
      scope: 'user',
      match_field: 'description',
      match_type: 'contains',
      pattern,
      category_id: categoryId,
    });
    setSaving(false);
    onClose();
  }

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Criar regra de categorização</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3">
          <div>
            <Label>Padrão (contém)</Label>
            <Input value={pattern} onChange={e => setPattern(e.target.value)} placeholder="ex: LIDL" />
          </div>
          <div>
            <Label>Categoria</Label>
            <Select value={categoryId} onValueChange={setCategoryId}>
              <SelectTrigger><SelectValue placeholder="Selecionar…" /></SelectTrigger>
              <SelectContent>
                {categories.map(c => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <Button onClick={handleSave} disabled={saving || !pattern || !categoryId}>
            {saving ? 'A guardar…' : 'Guardar regra'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
