import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, Save, X, MapPin, Calculator, Euro } from 'lucide-react';
import { PayrollMileageTrip, PayrollMileagePolicy } from '../types';
import { payrollService } from '../services/payrollService';
import { logger } from '@/shared/lib/logger';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { formatCurrency } from '@/lib/utils';
import { centsToEuros } from '../lib/calc';
import { formatDateLocal } from '@/lib/dateUtils';

interface MileageTripFormProps {
  trip?: PayrollMileageTrip;
  policies: PayrollMileagePolicy[];
  onSave: (trip: PayrollMileageTrip) => void;
  onCancel: () => void;
}

export function MileageTripForm({ trip, policies, onSave, onCancel }: MileageTripFormProps) {
  const { toast } = useToast();
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    policy_id: '',
    date: formatDateLocal(new Date()),
    origin: '',
    destination: '',
    km: 0,
    purpose: ''
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [selectedPolicy, setSelectedPolicy] = useState<PayrollMileagePolicy | null>(null);
  const [calculatedAmount, setCalculatedAmount] = useState(0);

  useEffect(() => {
    if (trip) {
      setFormData({
      policy_id: trip.policy_id,
      date: trip.date,
      origin: trip.origin,
      destination: trip.destination,
      km: trip.km,
      purpose: trip.purpose
    });
    } else {
      // Set default date to today
      const today = formatDateLocal(new Date());
      setFormData(prev => ({ ...prev, date: today }));
    }
  }, [trip]);

  useEffect(() => {
    if (formData.policy_id) {
      const policy = policies.find(p => p.id === formData.policy_id);
      setSelectedPolicy(policy || null);
      
      if (policy && formData.km > 0) {
      setCalculatedAmount(policy.rate_cents_per_km * formData.km);
      } else {
        setCalculatedAmount(0);
      }
    } else {
      setSelectedPolicy(null);
      setCalculatedAmount(0);
    }
  }, [formData.policy_id, formData.km, policies]);

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.policy_id) {
      newErrors.policy_id = 'Política é obrigatória';
    }

    if (!formData.date) {
      newErrors.date = 'Data da viagem é obrigatória';
    }

    if (!formData.origin.trim()) {
      newErrors.origin = 'Origem é obrigatória';
    }

    if (!formData.destination.trim()) {
      newErrors.destination = 'Destino é obrigatório';
    }

    if (formData.km <= 0) {
      newErrors.km = 'Distância deve ser maior que zero';
    }

    if (selectedPolicy?.requires_purpose && !formData.purpose.trim()) {
      newErrors.purpose = 'Propósito da viagem é obrigatório';
    }

    // Policy limits validation removed - max_km_per_month field no longer exists

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm() || !user?.id) {
      return;
    }

    // Garantir que a política selecionada existe e tem contract_id
    const policy = policies.find(p => p.id === formData.policy_id) || selectedPolicy;
    if (!policy || !policy.contract_id) {
      setErrors(prev => ({ ...prev, policy_id: 'Política inválida. Selecione uma política válida.' }));
      return;
    }

    setLoading(true);
    try {
      const tripData = {
        ...formData,
        // assegurar que o contract_id é enviado para o backend
        contract_id: policy.contract_id
      };

      let savedTrip: PayrollMileageTrip;
      
      if (trip) {
        savedTrip = await payrollService.updateMileageTrip(trip.id, tripData);
        toast({
          title: 'Viagem Atualizada',
          description: 'A viagem foi atualizada com sucesso.'
        });
      } else {
        savedTrip = await payrollService.createMileageTrip(user.id, formData.policy_id, tripData as any);
        toast({
          title: 'Viagem Registada',
          description: 'A viagem foi registada com sucesso.'
        });
      }

      onSave(savedTrip);
    } catch (error) {
      toast({
        title: 'Erro',
        description: 'Erro ao salvar viagem.',
        variant: 'destructive'
      });
      logger.error('Error saving mileage trip:', error);
    } finally {
      setLoading(false);
    }
  };

  const activePolicies = policies.filter(p => p.is_active);

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MapPin className="h-5 w-5" />
            Detalhes da Viagem
          </CardTitle>
          <CardDescription>
            Registe os detalhes da viagem para reembolso de quilometragem.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="policy_id">Política de Quilometragem *</Label>
              <Select
                value={formData.policy_id}
                onValueChange={(value) => setFormData(prev => ({ ...prev, policy_id: value }))}
              >
                <SelectTrigger className={errors.policy_id ? 'border-red-500' : ''}>
                  <SelectValue placeholder="Selecione uma política" />
                </SelectTrigger>
                <SelectContent>
                  {activePolicies.map((policy) => (
                    <SelectItem key={policy.id} value={policy.id}>
                      {policy.name} ({formatCurrency(policy.rate_cents_per_km)}/km)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.policy_id && (
                <p className="text-sm text-red-500 mt-1">{errors.policy_id}</p>
              )}
            </div>

            <div>
              <Label htmlFor="date">Data da Viagem *</Label>
                <Input
                  id="date"
                  type="date"
                  value={formData.date}
                  onChange={(e) => setFormData(prev => ({ ...prev, date: e.target.value }))}
                  className={errors.date ? 'border-red-500' : ''}
                />
                {errors.date && (
                  <p className="text-sm text-red-500 mt-1">{errors.date}</p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="origin">Origem *</Label>
              <Input
                id="origin"
                value={formData.origin}
                onChange={(e) => setFormData(prev => ({ ...prev, origin: e.target.value }))}
                placeholder="Ex: Escritório Lisboa"
                className={errors.origin ? 'border-red-500' : ''}
              />
              {errors.origin && (
                <p className="text-sm text-red-500 mt-1">{errors.origin}</p>
              )}
            </div>

            <div>
              <Label htmlFor="destination">Destino *</Label>
              <Input
                id="destination"
                value={formData.destination}
                onChange={(e) => setFormData(prev => ({ ...prev, destination: e.target.value }))}
                placeholder="Ex: Cliente Porto"
                className={errors.destination ? 'border-red-500' : ''}
              />
              {errors.destination && (
                <p className="text-sm text-red-500 mt-1">{errors.destination}</p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="km">Distância (km) *</Label>
              <Input
                id="km"
                type="number"
                step="0.1"
                min="0"
                value={formData.km || ''}
                onChange={(e) => setFormData(prev => ({
                  ...prev,
                  km: parseFloat(e.target.value) || 0
                }))}
                placeholder="Ex: 125.5"
                className={errors.km ? 'border-red-500' : ''}
              />
              {errors.km && (
                <p className="text-sm text-red-500 mt-1">{errors.km}</p>
              )}
              <p className="text-xs text-muted-foreground mt-1">
                Distância total da viagem (ida e volta se aplicável)
              </p>
            </div>

            <div>
              <Label htmlFor="purpose">Propósito da Viagem{selectedPolicy?.requires_purpose ? ' *' : ''}</Label>
              <Input
                id="purpose"
                value={formData.purpose}
                onChange={(e) => setFormData(prev => ({ ...prev, purpose: e.target.value }))}
                placeholder="Ex: Reunião com cliente"
                className={errors.purpose ? 'border-red-500' : ''}
              />
              {errors.purpose && (
                <p className="text-sm text-red-500 mt-1">{errors.purpose}</p>
              )}
            </div>
          </div>


        </CardContent>
      </Card>

      {/* Cálculo do Reembolso */}
      {selectedPolicy && formData.km > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calculator className="h-5 w-5" />
              Cálculo do Reembolso
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="bg-muted/50 p-4 rounded-lg space-y-2">
              <div className="flex justify-between items-center">
                <span>Política:</span>
                <span className="font-medium">{selectedPolicy.name}</span>
              </div>
              <div className="flex justify-between items-center">
                <span>Taxa por km:</span>
                <span className="font-medium">{formatCurrency(selectedPolicy.rate_cents_per_km)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span>Distância:</span>
                <span className="font-medium">{formData.km} km</span>
              </div>
              <div className="border-t pt-2">
                <div className="flex justify-between items-center text-lg font-semibold">
                  <span>Total a Reembolsar:</span>
                  <span className="text-green-600">
                    {formatCurrency(calculatedAmount)}
                  </span>
                </div>
              </div>
              
              {/* Monthly limit display removed - max_km_per_month field no longer exists */}
              

            </div>
          </CardContent>
        </Card>
      )}

      {/* Ações */}
      <div className="flex justify-end space-x-2">
        <Button type="button" variant="outline" onClick={onCancel}>
          <X className="mr-2 h-4 w-4" />
          Cancelar
        </Button>
        <Button type="submit" disabled={loading}>
          {loading ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Save className="mr-2 h-4 w-4" />
          )}
          {loading ? 'Salvando...' : (trip ? 'Atualizar' : 'Registar')} Viagem
        </Button>
      </div>
    </form>
  );
}