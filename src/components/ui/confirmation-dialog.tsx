import React, { useEffect, useRef } from 'react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from './alert-dialog';
import { Button } from './button';

interface ConfirmationDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  onCancel?: () => void;
  title?: string;
  message?: string;
  confirmText?: string;
  cancelText?: string;
  variant?: 'destructive' | 'default';
}

export const ConfirmationDialog = ({
  isOpen,
  onClose,
  onConfirm,
  onCancel,
  title = 'Confirmar ação',
  message = 'Tem a certeza que deseja continuar?',
  confirmText = 'Confirmar',
  cancelText = 'Cancelar',
  variant = 'default',
}: ConfirmationDialogProps) => {
  const cancelRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (isOpen) {
      // foco inicial previsível
      cancelRef.current?.focus();
    }
  }, [isOpen]);

  const handleConfirm = () => {
    onConfirm();
    onClose();
  };

  const handleCancel = () => {
    onCancel?.();
    onClose();
  };

  const safeTitle = title?.trim() || 'Confirmar ação';
  const safeMessage = message?.trim() || 'Tem a certeza que deseja continuar?';

  return (
    <AlertDialog open={isOpen} onOpenChange={onClose}>
      {/* Fornecer sempre um nome acessível ao Content para evitar warnings transitórios */}
      <AlertDialogContent aria-label={safeTitle}>
        <AlertDialogHeader>
          <AlertDialogTitle>{safeTitle}</AlertDialogTitle>
          <AlertDialogDescription>{safeMessage}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={handleCancel} ref={cancelRef} aria-label={cancelText}>
            {cancelText}
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={handleConfirm}
            className={variant === 'destructive' ? 'bg-red-600 hover:bg-red-700' : ''}
            aria-label={confirmText}
          >
            {confirmText}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};