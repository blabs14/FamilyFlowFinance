import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import { toast as sonnerToast } from '../components/ui/sonner';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function showError(message: string) {
  sonnerToast.error(message, { duration: 5000 });
}

export function showSuccess(message: string) {
  sonnerToast.success(message, { duration: 4000 });
}

export function formatCurrency(
  value: number, 
  locale: string = 'pt-PT', 
  currency: string = 'EUR'
): string {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: currency
  }).format(value);
}

// Função para obter ícone baseado no nome da categoria
export const getCategoryIcon = (categoryName: string) => {
  const name = categoryName.toLowerCase();
  
  // Mapeamento de categorias para ícones
  const iconMap: Record<string, string> = {
    // Alimentação
    'alimentação': 'Utensils',
    'alimentacao': 'Utensils',
    'comida': 'Utensils',
    'restaurante': 'Utensils',
    'supermercado': 'ShoppingCart',
    'groceries': 'ShoppingCart',
    
    // Transporte
    'transporte': 'Car',
    'gasolina': 'Fuel',
    'combustível': 'Fuel',
    'combustivel': 'Fuel',
    'uber': 'Car',
    'taxi': 'Car',
    'metro': 'Train',
    'autocarro': 'Bus',
    'bus': 'Bus',
    
    // Habitação
    'habitação': 'Home',
    'habitacao': 'Home',
    'casa': 'Home',
    'aluguer': 'Home',
    'aluguel': 'Home',
    'electricidade': 'Zap',
    'água': 'Droplets',
    'agua': 'Droplets',
    'gás': 'Flame',
    'gas': 'Flame',
    'internet': 'Wifi',
    'telefone': 'Phone',
    
    // Saúde
    'saúde': 'Heart',
    'saude': 'Heart',
    'médico': 'Stethoscope',
    'medico': 'Stethoscope',
    'farmacia': 'Pill',
    'farmácia': 'Pill',
    'hospital': 'Building2',
    
    // Educação
    'educação': 'GraduationCap',
    'educacao': 'GraduationCap',
    'escola': 'GraduationCap',
    'universidade': 'GraduationCap',
    'livros': 'BookOpen',
    'cursos': 'GraduationCap',
    
    // Lazer
    'lazer': 'Gamepad2',
    'entretenimento': 'Gamepad2',
    'cinema': 'Film',
    'teatro': 'Theater',
    'música': 'Music',
    'musica': 'Music',
    'desporto': 'Dumbbell',
    'gym': 'Dumbbell',
    'ginásio': 'Dumbbell',
    'ginasio': 'Dumbbell',
    
    // Vestuário
    'vestuário': 'Shirt',
    'vestuario': 'Shirt',
    'roupas': 'Shirt',
    'sapatos': 'Shoe',
    'acessórios': 'Watch',
    'acessorios': 'Watch',
    
    // Serviços
    'serviços': 'Settings',
    'servicos': 'Settings',
    'manutenção': 'Wrench',
    'manutencao': 'Wrench',
    'limpeza': 'Sparkles',
    
    // Transferências
    'transferências': 'ArrowRightLeft',
    'transferencias': 'ArrowRightLeft',
    'transfer': 'ArrowRightLeft',
    
    // Outros
    'outros': 'MoreHorizontal',
    'diversos': 'MoreHorizontal',
    'imprevistos': 'AlertTriangle',
    'emergência': 'AlertTriangle',
    'emergencia': 'AlertTriangle',
  };
  
  // Procurar por correspondências exatas ou parciais
  for (const [key, icon] of Object.entries(iconMap)) {
    if (name.includes(key) || key.includes(name)) {
      return icon;
    }
  }
  
  // Se não encontrar correspondência, retornar ícone padrão
  return 'Target';
};
