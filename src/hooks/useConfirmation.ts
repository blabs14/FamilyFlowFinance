import { useState, useCallback } from 'react';

export interface ConfirmationOptions {
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  variant?: 'default' | 'destructive';
}

export interface ConfirmationState {
  isOpen: boolean;
  options: ConfirmationOptions;
  onConfirm?: () => void;
  onCancel?: () => void;
}

export interface UseConfirmationReturn {
  isOpen: boolean;
  options: ConfirmationOptions;
  onConfirm?: () => void;
  onCancel?: () => void;
  confirm: (options: ConfirmationOptions) => Promise<boolean>;
  close: () => void;
}

const defaultOptions: ConfirmationOptions = {
  title: 'Confirmar',
  message: 'Tens a certeza?',
  confirmText: 'Confirmar',
  cancelText: 'Cancelar',
  variant: 'default'
};

export const useConfirmation = (): UseConfirmationReturn => {
  const [state, setState] = useState<ConfirmationState>({
    isOpen: false,
    options: defaultOptions,
    onConfirm: undefined,
    onCancel: undefined
  });

  const confirm = useCallback((options: ConfirmationOptions): Promise<boolean> => {
    return new Promise((resolve) => {
      const handleConfirm = () => {
        setState(prev => ({ ...prev, isOpen: false }));
        resolve(true);
      };

      const handleCancel = () => {
        setState(prev => ({ ...prev, isOpen: false }));
        resolve(false);
      };

      setState({
        isOpen: true,
        options: { ...defaultOptions, ...options },
        onConfirm: handleConfirm,
        onCancel: handleCancel
      });
    });
  }, []);

  const close = useCallback(() => {
    setState(prev => ({ ...prev, isOpen: false }));
  }, []);

  return {
    isOpen: state.isOpen,
    options: state.options,
    onConfirm: state.onConfirm,
    onCancel: state.onCancel,
    confirm,
    close
  };
};

export default useConfirmation;