import React, { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Calendar, CalendarDays, FileText, Plus, Edit, Trash2, Check, X, AlertCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { PayrollLeave, PayrollLeaveFormData, LEAVE_TYPES } from '../types';
import { payrollService } from '../services/payrollService';
import { useAuth } from '@/contexts/AuthContext';
import { format, differenceInDays, parseISO } from 'date-fns';
import { pt } from 'date-fns/locale';
import { withContext, maskId } from '@/shared/lib/logger';
import { isValidUUID } from '@/lib/validation';

interface PayrollLeavesManagerProps {
  contractId?: string;
}

export function PayrollLeavesManager({ contractId }: PayrollLeavesManagerProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [leaves, setLeaves] = useState<PayrollLeave[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingLeave, setEditingLeave] = useState<PayrollLeave | null>(null);
  const [formData, setFormData] = useState<PayrollLeaveFormData>({
    leave_type: '',
    start_date: '',
    end_date: '',
    reason: '',
    medical_certificate: false,
    notes: ''
  });
  // Unit 12a: employer_days for sick leave (days employer pays before SS takes over)
  const [employerDays, setEmployerDays] = useState(3);
  const correlationId = useRef(globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
  const log = withContext({ feature: 'payroll', component: 'PayrollLeavesManager', correlationId: correlationId.current });

  useEffect(() => {
    if (user?.id) {
      loadLeaves();
    }
  }, [user?.id]);

  const loadLeaves = async () => {
    try {
      setLoading(true);
      const data = await payrollService.getLeaves(user!.id, contractId);
      setLeaves(data);
    } catch (error) {
      log.error('Failed to load leaves', {
        error: error instanceof Error ? error.message : String(error),
        userId: maskId(user?.id),
        contractId: maskId(contractId),
      });
      toast({
        title: 'Erro',
        description: 'Não foi possível carregar as licenças.',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const calculateDays = (startDate: string, endDate: string): number => {
    if (!startDate || !endDate) return 0;
    return differenceInDays(parseISO(endDate), parseISO(startDate)) + 1;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!user?.id) {
      toast({
        title: 'Erro',
        description: 'Utilizador não autenticado.',
        variant: 'destructive'
      });
      return;
    }

    if (!contractId) {
      toast({
        title: 'Erro',
        description: 'ID do contrato não fornecido.',
        variant: 'destructive'
      });
      return;
    }

    // Validar se o contractId é um UUID válido
    if (!isValidUUID(contractId)) {
      toast({
        title: 'Erro',
        description: 'ID do contrato deve ser um UUID válido. Por favor, selecione um contrato válido.',
        variant: 'destructive'
      });
      return;
    }

    try {
      // Validar datas
      if (new Date(formData.start_date) > new Date(formData.end_date)) {
        toast({
          title: 'Erro',
          description: 'A data de início deve ser anterior à data de fim.',
          variant: 'destructive'
        });
        return;
      }

      // Verificar sobreposição
      const hasOverlap = await payrollService.checkLeaveOverlap(
        user.id,
        formData.start_date,
        formData.end_date,
        contractId,
        editingLeave?.id
      );

      if (hasOverlap) {
        toast({
          title: 'Erro',
          description: 'Já existe uma licença no período selecionado.',
          variant: 'destructive'
        });
        return;
      }

      // Calcular dias automaticamente
      const totalDays = calculateDays(formData.start_date, formData.end_date);
      const leaveType = LEAVE_TYPES[formData.leave_type as keyof typeof LEAVE_TYPES];
      
      const submitData = {
        ...formData,
        contract_id: contractId,
        paid_days: formData.paid_days || Math.floor(totalDays * (leaveType?.defaultPaid || 100) / 100),
        unpaid_days: formData.unpaid_days || (totalDays - Math.floor(totalDays * (leaveType?.defaultPaid || 100) / 100)),
        percentage_paid: formData.percentage_paid || leaveType?.defaultPaid || 100,
        // Unit 12a: days employer pays before SS (only meaningful for sick leave)
        employer_days: formData.leave_type === 'sick' ? employerDays : undefined,
      };

      if (editingLeave) {
        await payrollService.updateLeave(editingLeave.id, submitData, user.id, contractId);
        toast({
          title: 'Sucesso',
          description: 'Licença atualizada com sucesso.'
        });
      } else {
        await payrollService.createLeave(user.id, submitData, contractId);
        toast({
          title: 'Sucesso',
          description: 'Licença criada com sucesso.'
        });
      }

      await loadLeaves();
      resetForm();
    } catch (error) {
      log.error('Failed to process leave', {
        error: error instanceof Error ? error.message : String(error),
        userId: maskId(user?.id),
        contractId: maskId(contractId),
        editing: !!editingLeave,
        leaveId: maskId(editingLeave?.id),
      });
      toast({
        title: 'Erro',
        description: `Não foi possível salvar a licença: ${error instanceof Error ? error.message : 'Erro desconhecido'}`,
        variant: 'destructive'
      });
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await payrollService.deleteLeave(id, user?.id, contractId);
      toast({
        title: 'Sucesso',
        description: 'Licença excluída com sucesso.'
      });
      await loadLeaves();
    } catch (error) {
      log.error('Failed to delete leave', {
        error: error instanceof Error ? error.message : String(error),
        id: maskId(id),
        userId: maskId(user?.id),
        contractId: maskId(contractId),
      });
      toast({
        title: 'Erro',
        description: 'Não foi possível excluir a licença.',
        variant: 'destructive'
      });
    }
  };

  const handleApprove = async (id: string) => {
    try {
      await payrollService.approveLeave(id, user!.id, user!.id, contractId);
      toast({
        title: 'Sucesso',
        description: 'Licença aprovada com sucesso.'
      });
      await loadLeaves();
    } catch (error) {
      log.error('Failed to approve leave', {
        error: error instanceof Error ? error.message : String(error),
        id: maskId(id),
        approverId: maskId(user?.id),
        contractId: maskId(contractId),
      });
      toast({
        title: 'Erro',
        description: 'Não foi possível aprovar a licença.',
        variant: 'destructive'
      });
    }
  };

  const handleReject = async (id: string) => {
    try {
      await payrollService.rejectLeave(id, user!.id, user!.id, contractId);
        toast({
        title: 'Sucesso',
        description: 'Licença rejeitada com sucesso.'
      });
      await loadLeaves();
    } catch (error) {
      log.error('Failed to reject leave', {
        error: error instanceof Error ? error.message : String(error),
        id: maskId(id),
        reviewerId: maskId(user?.id),
        contractId: maskId(contractId),
      });
      toast({
        title: 'Erro',
        description: 'Não foi possível rejeitar a licença.',
        variant: 'destructive'
      });
    }
  };

  const resetForm = () => {
    setFormData({
      leave_type: '',
      start_date: '',
      end_date: '',
      reason: '',
      medical_certificate: false,
      notes: ''
    });
    setEditingLeave(null);
    setDialogOpen(false);
  };

  const openEditDialog = (leave: PayrollLeave) => {
    setEditingLeave(leave);
    setFormData({
      leave_type: leave.leave_type,
      start_date: leave.start_date,
      end_date: leave.end_date,
      paid_days: leave.paid_days,
      unpaid_days: leave.unpaid_days,
      percentage_paid: leave.percentage_paid,
      reason: leave.reason || '',
      medical_certificate: leave.medical_certificate,
      notes: leave.notes || ''
    });
    setDialogOpen(true);
  };

  const openNewDialog = () => {
    resetForm();
    setDialogOpen(true);
  };

  const getStatusBadge = (status: string) => {
    const variants = {
      pending: 'secondary',
      approved: 'default',
      rejected: 'destructive',
      active: 'default',
      completed: 'outline'
    } as const;

    const labels = {
      pending: 'Pendente',
      approved: 'Aprovada',
      rejected: 'Rejeitada',
      active: 'Ativa',
      completed: 'Concluída'
    };

    return (
      <Badge variant={variants[status as keyof typeof variants] || 'secondary'}>
        {labels[status as keyof typeof labels] || status}
      </Badge>
    );
  };

  const handleLeaveTypeChange = (value: string) => {
    setFormData(prev => ({ ...prev, leave_type: value }));
    
    // Auto-preencher valores padrão baseados no tipo de licença
    const leaveType = LEAVE_TYPES[value as keyof typeof LEAVE_TYPES];
    if (leaveType && formData.start_date && formData.end_date) {
      const totalDays = calculateDays(formData.start_date, formData.end_date);
      const paidDays = Math.floor(totalDays * leaveType.defaultPaid / 100);
      
      setFormData(prev => ({
        ...prev,
        paid_days: paidDays,
        unpaid_days: totalDays - paidDays,
        percentage_paid: leaveType.defaultPaid
      }));
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CalendarDays className="h-5 w-5" />
            Licenças Especiais
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <CalendarDays className="h-5 w-5" />
              Licenças Especiais
            </CardTitle>
            <CardDescription>
              Gestão de licenças parentais, médicas e outras licenças especiais
            </CardDescription>
          </div>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={openNewDialog}>
                <Plus className="h-4 w-4 mr-2" />
                Nova Licença
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>
                  {editingLeave ? 'Editar Licença' : 'Nova Licença'}
                </DialogTitle>
                <DialogDescription>
                  {editingLeave 
                    ? 'Atualize os dados da licença.' 
                    : 'Preencha os dados para criar uma nova licença.'}
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="leave_type">Tipo de Licença</Label>
                    <Select value={formData.leave_type} onValueChange={handleLeaveTypeChange}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione o tipo" />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(LEAVE_TYPES).map(([key, type]) => (
                          <SelectItem key={key} value={key}>
                            {type.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="start_date">Data de Início</Label>
                    <Input
                      id="start_date"
                      type="date"
                      value={formData.start_date}
                      onChange={(e) => setFormData(prev => ({ ...prev, start_date: e.target.value }))}
                      required
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="end_date">Data de Fim</Label>
                    <Input
                      id="end_date"
                      type="date"
                      value={formData.end_date}
                      onChange={(e) => setFormData(prev => ({ ...prev, end_date: e.target.value }))}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Total de Dias</Label>
                    <Input
                      value={calculateDays(formData.start_date, formData.end_date)}
                      disabled
                      className="bg-muted"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="paid_days">Dias Pagos</Label>
                    <Input
                      id="paid_days"
                      type="number"
                      min="0"
                      value={formData.paid_days || ''}
                      onChange={(e) => setFormData(prev => ({ ...prev, paid_days: parseInt(e.target.value) || 0 }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="unpaid_days">Dias Não Pagos</Label>
                    <Input
                      id="unpaid_days"
                      type="number"
                      min="0"
                      value={formData.unpaid_days || ''}
                      onChange={(e) => setFormData(prev => ({ ...prev, unpaid_days: parseInt(e.target.value) || 0 }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="percentage_paid">% Pago</Label>
                    <Input
                      id="percentage_paid"
                      type="number"
                      min="0"
                      max="100"
                      value={formData.percentage_paid || ''}
                      onChange={(e) => setFormData(prev => ({ ...prev, percentage_paid: parseInt(e.target.value) || 0 }))}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="reason">Motivo/Justificação</Label>
                  <Textarea
                    id="reason"
                    value={formData.reason}
                    onChange={(e) => setFormData(prev => ({ ...prev, reason: e.target.value }))}
                    placeholder="Descreva o motivo da licença..."
                  />
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="medical_certificate"
                    checked={formData.medical_certificate}
                    onCheckedChange={(checked) =>
                      setFormData(prev => ({ ...prev, medical_certificate: checked as boolean }))
                    }
                  />
                  <Label htmlFor="medical_certificate">Requer atestado médico</Label>
                </div>

                {/* Unit 12a: employer_days for sick leave */}
                {formData.leave_type === 'sick' && (
                  <div className="space-y-1">
                    <Label htmlFor="employer-days">Dias a cargo do empregador</Label>
                    <Input
                      id="employer-days"
                      type="number"
                      min="0"
                      max="30"
                      value={employerDays}
                      onChange={e => setEmployerDays(parseInt(e.target.value, 10) || 0)}
                    />
                    <p className="text-xs text-muted-foreground">
                      Default: 3 dias. A partir do dia {employerDays + 1}, a Segurança Social paga.
                    </p>
                  </div>
                )}
                <div className="space-y-2">
                  <Label htmlFor="notes">Observações</Label>
                  <Textarea
                    id="notes"
                    value={formData.notes}
                    onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                    placeholder="Observações adicionais..."
                  />
                </div>
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={resetForm}>
                    Cancelar
                  </Button>
                  <Button type="submit">
                    {editingLeave ? 'Atualizar' : 'Criar'} Licença
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        {leaves.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <CalendarDays className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>Nenhuma licença registada</p>
            <p className="text-sm">Clique em "Nova Licença" para começar</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tipo</TableHead>
                <TableHead>Período</TableHead>
                <TableHead>Dias</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Atestado</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {leaves.map((leave) => {
                const leaveType = LEAVE_TYPES[leave.leave_type as keyof typeof LEAVE_TYPES];
                return (
                  <TableRow key={leave.id}>
                    <TableCell>
                      <div>
                        <div className="font-medium">{leaveType?.label || leave.leave_type}</div>
                        {leave.reason && (
                          <div className="text-sm text-muted-foreground">{leave.reason}</div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">
                        <div>{format(parseISO(leave.start_date), 'dd/MM/yyyy', { locale: pt })}</div>
                        <div className="text-muted-foreground">
                          até {format(parseISO(leave.end_date), 'dd/MM/yyyy', { locale: pt })}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">
                        <div>{leave.total_days} dias total</div>
                        <div className="text-muted-foreground">
                          {leave.paid_days} pagos, {leave.unpaid_days} não pagos
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>{getStatusBadge(leave.status)}</TableCell>
                    <TableCell>
                      {leave.medical_certificate ? (
                        <FileText className="h-4 w-4 text-blue-600" />
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        {leave.status === 'pending' && (
                          <>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleApprove(leave.id)}
                              className="text-green-600 hover:text-green-700"
                            >
                              <Check className="h-4 w-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleReject(leave.id)}
                              className="text-red-600 hover:text-red-700"
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </>
                        )}
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => openEditDialog(leave)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleDelete(leave.id)}
                          className="text-red-600 hover:text-red-700"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}