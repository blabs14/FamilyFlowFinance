import React, { createContext, useContext } from 'react';
import type { FamilyContextType } from '../../types/family';

export const FamilyContext = createContext<FamilyContextType | undefined>(undefined);

export const useFamily = () => {
  const context = useContext(FamilyContext);
  if (context === undefined) {
    throw new Error('useFamily must be used within a FamilyProvider');
  }
  return context;
}; 

export const useOptionalFamily = () => {
  return useContext(FamilyContext);
};