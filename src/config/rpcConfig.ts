/**
 * Configurações para chamadas RPC e retry logic
 */

export interface RetryConfig {
  maxRetries: number;
  baseDelay: number;
  maxDelay: number;
  timeout: number;
}

export const RPC_CONFIG: RetryConfig = {
  // Número máximo de tentativas (incluindo a primeira)
  maxRetries: 3,
  
  // Delay inicial em milissegundos
  baseDelay: 1000,
  
  // Delay máximo em milissegundos (para evitar delays muito longos)
  maxDelay: 10000,
  
  // Timeout para cada chamada RPC em milissegundos
  timeout: 30000, // 30 segundos
};

/**
 * Verifica se um erro é um erro de rede que vale a pena tentar novamente
 */
export const isRetryableNetworkError = (error: unknown): boolean => {
  if (!(error instanceof Error)) {
    return false;
  }
  
  const retryablePatterns = [
    'Failed to fetch',
    'ERR_ABORTED',
    'TypeError: Failed to fetch',
    'Network request failed',
    'fetch',
    'ECONNRESET',
    'ENOTFOUND',
    'ECONNREFUSED',
    'ETIMEDOUT',
    'ERR_NETWORK',
    'ERR_INTERNET_DISCONNECTED'
  ];
  
  return retryablePatterns.some(pattern => 
    error.message.includes(pattern)
  );
};

/**
 * Calcula o delay para a próxima tentativa usando backoff exponencial
 */
export const calculateRetryDelay = (
  attempt: number, 
  baseDelay: number = RPC_CONFIG.baseDelay,
  maxDelay: number = RPC_CONFIG.maxDelay
): number => {
  const exponentialDelay = baseDelay * Math.pow(2, attempt);
  return Math.min(exponentialDelay, maxDelay);
};

/**
 * Função auxiliar para retry com backoff exponencial configurável
 */
export const retryWithBackoff = async <T>(
  fn: () => Promise<T>,
  config: Partial<RetryConfig> = {}
): Promise<T> => {
  const { maxRetries, baseDelay, maxDelay } = { ...RPC_CONFIG, ...config };
  let lastError: Error;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;
      
      // Se é o último attempt, lança o erro
      if (attempt === maxRetries) {
        throw lastError;
      }
      
      // Verificar se é um erro de rede que vale a pena tentar novamente
      if (!isRetryableNetworkError(error)) {
        // Se não é erro de rede, não vale a pena tentar novamente
        throw lastError;
      }
      
      // Calcular delay com backoff exponencial
      const delay = calculateRetryDelay(attempt, baseDelay, maxDelay);
      console.warn(`[RPC Retry] Tentativa ${attempt + 1} falhou, tentando novamente em ${delay}ms...`, {
        error: error instanceof Error ? error.message : error,
        attempt: attempt + 1,
        maxRetries: maxRetries + 1,
        delay
      });
      
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  throw lastError!;
};

/**
 * Wrapper para chamadas RPC com timeout configurável
 */
export const withTimeout = <T>(
  promise: Promise<T>,
  timeoutMs: number = RPC_CONFIG.timeout
): Promise<T> => {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(`Timeout após ${timeoutMs}ms`)), timeoutMs)
    )
  ]);
};