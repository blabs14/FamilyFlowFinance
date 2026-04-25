# Unit 4: Auth Security Cleanup — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove all active auth security vulnerabilities (password leak in console.log, public debug components, public test route, dead backup file) and harden auth UX (disable OAuth buttons with "Em breve", investigate 3s fallback timer, add onboarding empty-state scaffold).

**Architecture:** Each security fix is its own atomic task with its own commit — clean git history for a security patch. Tasks 1–4 are pure deletions/edits with no new dependencies. Task 5 (fallback timer investigation) is a read-then-decide step that ends with a documented decision. Task 6 (OAuth disable) is a UI-only change to LoginForm and RegisterForm. Task 7 (onboarding scaffold) creates the `src/features/onboarding/` directory with the empty-state hook and the 3-step mini-wizard shell; it does not touch the DB.

**Tech Stack:** React 18, TypeScript, Supabase Auth, Vitest, React Testing Library

---

## Desvios documentados

- `src/components/debug/DirectLoginTest.tsx` existe além de `src/components/auth/DirectLoginTest.tsx`. Ambos são apagados.
- A rota `/test` usa `TestPage.tsx` — nem `TestPage` nem `AuthTest.tsx` têm rota activa além de `/test`. Ambos os ficheiros são apagados juntamente com a rota.
- `src/test-supabase.ts` importado em `App.tsx` via `import './test-supabase'` — é um módulo de debug que corre automaticamente em produção. Apagado em Task 3.
- O `RegisterForm.tsx` não tem OAuth buttons (diferente do que o spec implica) — apenas `LoginForm.tsx` tem. Task 6 afeta apenas `LoginForm.tsx`.
- O mini-wizard (Task 7) é um scaffold: componentes criados com estrutura completa mas integração com DB (seed de categorias PT) fica para Unit 5+ conforme dependência `categories.is_system`.

---

## Estrutura de Ficheiros

### Apagar
- `src/components/auth/DirectLoginTest.tsx` — componente de debug renderizado na página pública de login
- `src/components/debug/DirectLoginTest.tsx` — duplicado do componente de debug
- `src/pages/AuthTest.tsx` — página de teste de autenticação sem protecção de rota
- `src/pages/TestPage.tsx` — página de teste sem protecção de rota
- `src/contexts/AuthContext.backup.tsx` — cópia morta do AuthContext

### Modificar
- `src/components/auth/LoginForm.tsx` — remover todos os `console.log` de debug (incluindo password); desabilitar botões OAuth com label "Em breve"
- `src/pages/login.tsx` — remover import e render de `DirectLoginTest`
- `src/App.tsx` — remover rota `/test`, remover import de `TestPage`, remover `import './test-supabase'`
- `src/contexts/AuthContext.tsx` — investigar e documentar decisão sobre fallback timer de 3s

### Criar
- `src/components/auth/LoginForm.test.tsx` — testes TDD para LoginForm (sem console.log de password, OAuth buttons disabled)
- `src/features/onboarding/useOnboardingState.ts` — hook que detecta primeiro login via `localStorage` flag
- `src/features/onboarding/useOnboardingState.test.ts` — testes do hook
- `src/features/onboarding/OnboardingWizard.tsx` — wizard de 3 passos (skippable)
- `src/features/onboarding/OnboardingWizard.test.tsx` — testes do wizard
- `src/features/onboarding/EmptyState.tsx` — componente genérico de empty state reutilizável
- `src/features/onboarding/EmptyState.test.tsx` — testes do empty state
- `src/features/onboarding/index.ts` — re-exports públicos

---

### Task 1: Remover console.log de password em LoginForm

**Ficheiros:**
- Modificar: `src/components/auth/LoginForm.tsx`
- Criar: `src/components/auth/LoginForm.test.tsx`

- [ ] **Step 1.1: Escrever o teste que falha**

```typescript
// src/components/auth/LoginForm.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

// Mock AuthContext
const mockLogin = vi.fn();
vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({
    login: mockLogin,
    loading: false,
    user: null,
  }),
}));

// Mock react-router-dom navigate
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return { ...actual, useNavigate: () => mockNavigate };
});

// Mock utils
vi.mock('../../lib/utils', () => ({
  showError: vi.fn(),
  cn: (...args: string[]) => args.filter(Boolean).join(' '),
}));

import LoginForm from './LoginForm';

describe('LoginForm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Spy on console.log to detect password leaks
    vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  it('não deve registar a password em console.log durante o login', async () => {
    mockLogin.mockResolvedValue({ error: null });

    render(
      <MemoryRouter>
        <LoginForm />
      </MemoryRouter>
    );

    fireEvent.change(screen.getByTestId('email-input') || screen.getByPlaceholderText('exemplo@email.com'), {
      target: { value: 'user@example.com' },
    });
    fireEvent.change(screen.getByPlaceholderText('Password'), {
      target: { value: 'mysecret123' },
    });
    fireEvent.click(screen.getByTestId('login-btn') || screen.getByRole('button', { name: /entrar/i }));

    await waitFor(() => {
      const calls = (console.log as any).mock.calls;
      const leaked = calls.some((args: any[]) =>
        args.some(
          (a) =>
            typeof a === 'string' &&
            (a.toLowerCase().includes('password') || a.includes('mysecret123'))
        )
      );
      expect(leaked).toBe(false);
    });
  });

  it('não deve ter nenhum [DEBUG] nos logs de console', async () => {
    mockLogin.mockResolvedValue({ error: null });

    render(
      <MemoryRouter>
        <LoginForm />
      </MemoryRouter>
    );

    fireEvent.click(screen.getByRole('button', { name: /entrar/i }));

    await waitFor(() => {
      const calls = (console.log as any).mock.calls;
      const hasDebug = calls.some((args: any[]) =>
        args.some((a) => typeof a === 'string' && a.includes('[DEBUG]'))
      );
      expect(hasDebug).toBe(false);
    });
  });

  it('redireciona para /app após login bem-sucedido', async () => {
    mockLogin.mockResolvedValue({ error: null });

    render(
      <MemoryRouter>
        <LoginForm />
      </MemoryRouter>
    );

    fireEvent.change(screen.getByPlaceholderText('exemplo@email.com'), {
      target: { value: 'user@example.com' },
    });
    fireEvent.change(screen.getByPlaceholderText('Password'), {
      target: { value: 'password123' },
    });
    fireEvent.click(screen.getByRole('button', { name: /entrar/i }));

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/app');
    });
  });
});
```

- [ ] **Step 1.2: Correr o teste para confirmar que falha**

```bash
npx vitest run src/components/auth/LoginForm.test.tsx
```

Esperado: FAIL — o teste deteta `[DEBUG]` e password nos logs.

- [ ] **Step 1.3: Substituir o handler `handleLogin` em LoginForm.tsx**

Substituir as linhas 35–71 (toda a função `handleLogin`) por:

```typescript
const handleLogin = async (data: LoginFormData) => {
  setError('');
  clearErrors();
  try {
    const result = await login(data.email, data.password);
    if (result?.error) {
      const msg = (result.error as any).message ?? 'Erro ao iniciar sessão';
      setError(msg);
      showError('Erro ao iniciar sessão: ' + msg);
      setFocus('email');
    } else {
      navigate('/app');
    }
  } catch (err) {
    setError('Erro inesperado durante o login');
  }
};
```

Remover também o handler `handleOAuth` e substituir por (manter o método mas remover o `console.log` OAuth):

```typescript
const handleOAuth = async (provider: 'google' | 'apple' | 'facebook') => {
  setError('');
  try {
    if (provider === 'google') await signInWithGoogle();
    if (provider === 'apple') await signInWithApple();
    if (provider === 'facebook') await signInWithFacebook();
  } catch (err: any) {
    const errorMessage = 'Erro ao autenticar com ' + provider;
    setError(errorMessage);
    showError(errorMessage);
  }
};
```

- [ ] **Step 1.4: Correr o teste para confirmar que passa**

```bash
npx vitest run src/components/auth/LoginForm.test.tsx
```

Esperado: PASS em todos os 3 testes.

- [ ] **Step 1.5: Verificar compilação TypeScript**

```bash
npx tsc --noEmit
```

Esperado: sem erros.

- [ ] **Step 1.6: Commit**

```bash
git add src/components/auth/LoginForm.tsx src/components/auth/LoginForm.test.tsx
git commit -m "security: remove password from console.log in LoginForm"
```

---

### Task 2: Remover DirectLoginTest da página pública de login

**Ficheiros:**
- Apagar: `src/components/auth/DirectLoginTest.tsx`
- Apagar: `src/components/debug/DirectLoginTest.tsx`
- Modificar: `src/pages/login.tsx`

- [ ] **Step 2.1: Verificar que DirectLoginTest não está importado noutros ficheiros**

```bash
grep -r "DirectLoginTest" src/ --include="*.ts" --include="*.tsx" -l
```

Esperado: apenas `src/pages/login.tsx`, `src/components/auth/DirectLoginTest.tsx`, `src/components/debug/DirectLoginTest.tsx`.

- [ ] **Step 2.2: Apagar os ficheiros de debug**

```bash
git rm src/components/auth/DirectLoginTest.tsx src/components/debug/DirectLoginTest.tsx
```

- [ ] **Step 2.3: Limpar login.tsx — remover import e bloco de debug**

Substituir o conteúdo de `src/pages/login.tsx` (remover o import de `DirectLoginTest` e o bloco `<div className="mt-4">...</div>` com o card de debug):

```typescript
import LoginForm from '../components/auth/LoginForm';
import { Link } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';

export default function Login() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <Card className="shadow-xl border-0 bg-gradient-card">
          <CardHeader className="text-center space-y-1">
            <div className="mx-auto w-12 h-12 bg-gradient-primary rounded-xl flex items-center justify-center mb-4">
              <span className="text-primary-foreground font-bold text-xl">F</span>
            </div>
            <CardTitle className="text-2xl font-bold text-foreground">Iniciar Sessão</CardTitle>
            <CardDescription className="text-muted-foreground">
              Aceda à sua conta para gerir as suas finanças
            </CardDescription>
          </CardHeader>
          <CardContent>
            <LoginForm />
            <div className="flex items-center justify-between mt-6 text-sm">
              <Link
                to="/register"
                className="text-primary hover:text-primary-dark transition-colors font-medium"
              >
                Criar nova conta
              </Link>
              <Link
                to="/forgot-password"
                className="text-primary hover:text-primary-dark transition-colors font-medium"
              >
                Recuperar password
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
```

- [ ] **Step 2.4: Verificar que nenhum import de DirectLoginTest sobrou**

```bash
grep -r "DirectLoginTest" src/ --include="*.ts" --include="*.tsx"
```

Esperado: sem resultados.

- [ ] **Step 2.5: Verificar compilação e testes**

```bash
npx tsc --noEmit && npx vitest run src/components/auth/LoginForm.test.tsx
```

Esperado: PASS.

- [ ] **Step 2.6: Commit**

```bash
git add src/pages/login.tsx
git commit -m "security: remove DirectLoginTest component from public login page"
```

---

### Task 3: Remover rota pública /test e código de debug de App.tsx

**Ficheiros:**
- Apagar: `src/pages/TestPage.tsx`
- Apagar: `src/pages/AuthTest.tsx`
- Apagar: `src/test-supabase.ts`
- Modificar: `src/App.tsx`

- [ ] **Step 3.1: Verificar dependências antes de apagar**

```bash
grep -r "TestPage\|AuthTest\|test-supabase" src/ --include="*.ts" --include="*.tsx" -l
```

Esperado: apenas `src/App.tsx` (importa `TestPage` e `test-supabase`). `AuthTest.tsx` não está importado em nenhum lugar (não tem rota definida em App.tsx — confirmar).

- [ ] **Step 3.2: Apagar os ficheiros de debug**

```bash
git rm src/pages/TestPage.tsx src/pages/AuthTest.tsx src/test-supabase.ts
```

- [ ] **Step 3.3: Remover imports e rota /test em App.tsx**

Em `src/App.tsx`, remover as seguintes linhas:

Remover a linha de import:
```typescript
import './test-supabase';
```

Remover a linha de import:
```typescript
import TestPage from './pages/TestPage';
```

Remover a rota:
```typescript
<Route path="/test" element={<TestPage />} />
```

O ficheiro App.tsx resultante mantém todas as outras rotas inalteradas.

- [ ] **Step 3.4: Verificar compilação**

```bash
npx tsc --noEmit
```

Esperado: sem erros de imports.

- [ ] **Step 3.5: Correr todos os testes**

```bash
npx vitest run
```

Esperado: todos os testes passam.

- [ ] **Step 3.6: Commit**

```bash
git add src/App.tsx
git commit -m "security: remove /test public route, TestPage, AuthTest, test-supabase.ts"
```

---

### Task 4: Apagar AuthContext.backup.tsx

**Ficheiros:**
- Apagar: `src/contexts/AuthContext.backup.tsx`

- [ ] **Step 4.1: Confirmar que o ficheiro não está importado**

```bash
grep -r "AuthContext.backup\|AuthContext\.backup" src/ --include="*.ts" --include="*.tsx"
```

Esperado: sem resultados.

- [ ] **Step 4.2: Apagar o ficheiro**

```bash
git rm src/contexts/AuthContext.backup.tsx
```

- [ ] **Step 4.3: Verificar compilação**

```bash
npx tsc --noEmit
```

Esperado: sem erros.

- [ ] **Step 4.4: Commit**

```bash
git commit -m "chore: remove AuthContext.backup.tsx dead file"
```

---

### Task 5: Investigar e documentar o fallback timer de 3s em AuthContext

**Ficheiros:**
- Modificar: `src/contexts/AuthContext.tsx`

**Contexto:** O timer em `AuthContext.tsx` (linhas 84–90) força `loading = false` ao fim de 3 segundos se `initializationComplete` for ainda `false`. O problema é que `initializationComplete` pode já ter sido definido como `true` pelo `onAuthStateChange` mas o timer ainda corre. A análise do código mostra que:

1. `onAuthStateChange` corre de forma assíncrona — o Supabase dispara-o imediatamente se há sessão em localStorage (via PKCE `persistSession: true`).
2. `initializeAuth()` corre em paralelo via `getSession()`.
3. O timer serve de guarda-chuva se ambos falharem (timeout de rede, Supabase down).
4. **Risco identificado:** se a rede demorar > 3s, o utilizador vê a app como "loaded" mas sem sessão — pode ser redireccionado para login indevidamente.
5. **Decisão (sub-decisão Unit 4):** manter o timer mas aumentar para 8s (mais razoável para dogfood em condições de rede móvel PT) e adicionar log estruturado para ser visível em produção se disparar.

- [ ] **Step 5.1: Escrever o teste do comportamento do timer**

```typescript
// src/contexts/AuthContext.test.tsx
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act, waitFor } from '@testing-library/react';
import React from 'react';

// Mock supabase antes de importar AuthContext
vi.mock('../lib/supabaseClient', () => ({
  supabase: {
    auth: {
      getSession: vi.fn(),
      onAuthStateChange: vi.fn(() => ({
        data: { subscription: { unsubscribe: vi.fn() } },
      })),
      signInWithPassword: vi.fn(),
      signUp: vi.fn(),
      resetPasswordForEmail: vi.fn(),
      signOut: vi.fn(),
    },
  },
}));

vi.mock('../hooks/useUserDataInvalidation', () => ({
  useUserDataInvalidation: vi.fn(),
}));

vi.mock('../shared/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import { AuthProvider, useAuth } from './AuthContext';
import { supabase } from '../lib/supabaseClient';
import { logger } from '../shared/lib/logger';

const TestConsumer: React.FC = () => {
  const { loading, user } = useAuth();
  return <div data-testid="status">{loading ? 'loading' : user ? 'authenticated' : 'unauthenticated'}</div>;
};

describe('AuthContext', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('começa em estado loading', () => {
    (supabase.auth.getSession as any).mockResolvedValue({ data: { session: null }, error: null });

    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>
    );

    expect(screen.getByTestId('status').textContent).toBe('loading');
  });

  it('resolve loading após getSession responder com sessão nula', async () => {
    (supabase.auth.getSession as any).mockResolvedValue({ data: { session: null }, error: null });

    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>
    );

    await act(async () => {
      await vi.runAllMicrotasksAsync();
    });

    expect(screen.getByTestId('status').textContent).toBe('unauthenticated');
  });

  it('fallback timer deve ter timeout >= 5000ms', async () => {
    // Simular getSession que nunca responde (timeout de rede)
    (supabase.auth.getSession as any).mockReturnValue(new Promise(() => {}));

    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>
    );

    // Após 4.9s ainda deve estar em loading
    act(() => { vi.advanceTimersByTime(4900); });
    expect(screen.getByTestId('status').textContent).toBe('loading');

    // Após 8s o fallback deve ter disparado
    act(() => { vi.advanceTimersByTime(3100); }); // total 8000ms
    await waitFor(() => {
      expect(screen.getByTestId('status').textContent).toBe('unauthenticated');
    });

    // O logger.warn deve ter sido chamado com mensagem de timeout
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('Timeout'),
      expect.anything()
    );
  });
});
```

- [ ] **Step 5.2: Correr o teste para confirmar que falha (timer está em 3s, teste espera >= 5s)**

```bash
npx vitest run src/contexts/AuthContext.test.tsx
```

Esperado: FAIL — o teste de fallback timer falha porque o timer atual é 3000ms e o teste avança 4900ms esperando ainda estar em loading (mas com 3s já resolveu).

- [ ] **Step 5.3: Atualizar o fallback timer de 3000ms para 8000ms**

Em `src/contexts/AuthContext.tsx`, localizar as linhas do `fallbackTimer`:

```typescript
// Fallback: garantir que loading seja false após 3 segundos
const fallbackTimer = setTimeout(() => {
  if (mounted && !initializationComplete) {
    logger.warn('[Auth] Timeout na inicialização - forçando loading = false');
    setLoading(false);
    initializationComplete = true;
  }
}, 3000);
```

Substituir por:

```typescript
// Fallback: garantir que loading seja false após 8 segundos
// (decisão Unit 4: 3s era demasiado curto para rede móvel PT; 8s é razoável para dogfood)
const fallbackTimer = setTimeout(() => {
  if (mounted && !initializationComplete) {
    logger.warn('[Auth] Timeout na inicialização auth (8s) — possível problema de rede ou Supabase', {
      timestamp: new Date().toISOString(),
    });
    setLoading(false);
    initializationComplete = true;
  }
}, 8000);
```

- [ ] **Step 5.4: Correr o teste para confirmar que passa**

```bash
npx vitest run src/contexts/AuthContext.test.tsx
```

Esperado: PASS em todos os 3 testes.

- [ ] **Step 5.5: Correr todos os testes para regressão**

```bash
npx vitest run
```

Esperado: todos os testes passam.

- [ ] **Step 5.6: Commit**

```bash
git add src/contexts/AuthContext.tsx src/contexts/AuthContext.test.tsx
git commit -m "fix: increase auth fallback timer from 3s to 8s, add structured timeout log"
```

---

### Task 6: Desabilitar botões OAuth com label "Em breve"

**Ficheiros:**
- Modificar: `src/components/auth/LoginForm.tsx`
- Modificar: `src/components/auth/LoginForm.test.tsx`

**Contexto:** Os botões Google, Apple e Facebook em `LoginForm.tsx` estão activos e chamam `handleOAuth`. O spec decide desabilitar visualmente com badge "Em breve" mas manter a estrutura para facilitar activação futura. `RegisterForm.tsx` não tem botões OAuth — não é afetado.

- [ ] **Step 6.1: Adicionar testes para os botões OAuth desabilitados**

Adicionar ao ficheiro `src/components/auth/LoginForm.test.tsx` (dentro do `describe('LoginForm')`):

```typescript
  it('botão Google deve estar desabilitado com texto "Em breve"', () => {
    render(
      <MemoryRouter>
        <LoginForm />
      </MemoryRouter>
    );
    const googleBtn = screen.getByRole('button', { name: /google/i });
    expect(googleBtn).toBeDisabled();
    expect(googleBtn).toHaveTextContent(/em breve/i);
  });

  it('botão Apple deve estar desabilitado com texto "Em breve"', () => {
    render(
      <MemoryRouter>
        <LoginForm />
      </MemoryRouter>
    );
    const appleBtn = screen.getByRole('button', { name: /apple/i });
    expect(appleBtn).toBeDisabled();
    expect(appleBtn).toHaveTextContent(/em breve/i);
  });

  it('botão Facebook deve estar desabilitado com texto "Em breve"', () => {
    render(
      <MemoryRouter>
        <LoginForm />
      </MemoryRouter>
    );
    const fbBtn = screen.getByRole('button', { name: /facebook/i });
    expect(fbBtn).toBeDisabled();
    expect(fbBtn).toHaveTextContent(/em breve/i);
  });

  it('clicar nos botões OAuth desabilitados não deve chamar signIn', async () => {
    const { signInWithGoogle } = await import('../../services/authProviders');
    render(
      <MemoryRouter>
        <LoginForm />
      </MemoryRouter>
    );
    const googleBtn = screen.getByRole('button', { name: /google/i });
    fireEvent.click(googleBtn);
    expect(signInWithGoogle).not.toHaveBeenCalled();
  });
```

Adicionar o mock de `authProviders` no topo do ficheiro de teste (após os outros mocks):

```typescript
vi.mock('../../services/authProviders', () => ({
  signInWithGoogle: vi.fn(),
  signInWithApple: vi.fn(),
  signInWithFacebook: vi.fn(),
}));
```

- [ ] **Step 6.2: Correr os testes para confirmar que falham**

```bash
npx vitest run src/components/auth/LoginForm.test.tsx
```

Esperado: FAIL — os botões ainda têm texto "Entrar com Google/Apple/Facebook" e não estão disabled.

- [ ] **Step 6.3: Atualizar os botões OAuth em LoginForm.tsx**

Localizar o bloco `<div className="space-y-2">` com os três botões OAuth (linhas 161–183) e substituir por:

```typescript
<div className="space-y-2">
  <Button
    type="button"
    disabled
    variant="outline"
    className="w-full opacity-60 cursor-not-allowed"
    aria-label="Entrar com Google — Em breve"
  >
    <div className="w-4 h-4 mr-2 bg-[#4285f4] rounded-sm flex items-center justify-center">
      <span className="text-white text-xs font-bold">G</span>
    </div>
    Entrar com Google
    <span className="ml-2 text-xs bg-muted text-muted-foreground px-1.5 py-0.5 rounded-full">
      Em breve
    </span>
  </Button>

  <Button
    type="button"
    disabled
    variant="outline"
    className="w-full opacity-60 cursor-not-allowed"
    aria-label="Entrar com Apple — Em breve"
  >
    <div className="w-4 h-4 mr-2 bg-black rounded-sm flex items-center justify-center">
      <span className="text-white text-xs">🍎</span>
    </div>
    Entrar com Apple
    <span className="ml-2 text-xs bg-muted text-muted-foreground px-1.5 py-0.5 rounded-full">
      Em breve
    </span>
  </Button>

  <Button
    type="button"
    disabled
    variant="outline"
    className="w-full opacity-60 cursor-not-allowed"
    aria-label="Entrar com Facebook — Em breve"
  >
    <div className="w-4 h-4 mr-2 bg-[#1877f2] rounded-sm flex items-center justify-center">
      <span className="text-white text-xs font-bold">f</span>
    </div>
    Entrar com Facebook
    <span className="ml-2 text-xs bg-muted text-muted-foreground px-1.5 py-0.5 rounded-full">
      Em breve
    </span>
  </Button>
</div>
```

Nota: com os botões `disabled` estáticos, o `handleOAuth` já não é chamado mas pode ficar no ficheiro para não quebrar nada — não há chamadas activas para ele.

- [ ] **Step 6.4: Correr os testes para confirmar que passam**

```bash
npx vitest run src/components/auth/LoginForm.test.tsx
```

Esperado: PASS em todos os testes.

- [ ] **Step 6.5: Verificar compilação**

```bash
npx tsc --noEmit
```

Esperado: sem erros.

- [ ] **Step 6.6: Commit**

```bash
git add src/components/auth/LoginForm.tsx src/components/auth/LoginForm.test.tsx
git commit -m "feat(auth): disable OAuth buttons with 'Em breve' label"
```

---

### Task 7: Scaffold do onboarding híbrido (empty states + mini-wizard)

**Ficheiros:**
- Criar: `src/features/onboarding/useOnboardingState.ts`
- Criar: `src/features/onboarding/useOnboardingState.test.ts`
- Criar: `src/features/onboarding/EmptyState.tsx`
- Criar: `src/features/onboarding/EmptyState.test.tsx`
- Criar: `src/features/onboarding/OnboardingWizard.tsx`
- Criar: `src/features/onboarding/OnboardingWizard.test.tsx`
- Criar: `src/features/onboarding/index.ts`

**Nota:** Esta task cria a estrutura completa do onboarding. A integração em cada página (Dashboard, Contas, etc.) fica para Units 5 e 6 conforme as dependências do spec. O seed de categorias PT (Passo 2 do wizard) depende de `categories.is_system` (Unit 2 Task 10) — o wizard inclui o passo mas delega a chamada para um callback prop.

- [ ] **Step 7.1: Escrever os testes do hook useOnboardingState**

```typescript
// src/features/onboarding/useOnboardingState.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => { store[key] = value; },
    removeItem: (key: string) => { delete store[key]; },
    clear: () => { store = {}; },
  };
})();
Object.defineProperty(window, 'localStorage', { value: localStorageMock, writable: true });

import { useOnboardingState } from './useOnboardingState';

describe('useOnboardingState', () => {
  beforeEach(() => {
    localStorageMock.clear();
  });

  it('showWizard é true no primeiro login (sem flag em localStorage)', () => {
    const { result } = renderHook(() => useOnboardingState());
    expect(result.current.showWizard).toBe(true);
  });

  it('showWizard é false após completeOnboarding ser chamado', () => {
    const { result } = renderHook(() => useOnboardingState());
    act(() => { result.current.completeOnboarding(); });
    expect(result.current.showWizard).toBe(false);
  });

  it('showWizard é false se flag já existir em localStorage', () => {
    localStorageMock.setItem('fff_onboarding_done', 'true');
    const { result } = renderHook(() => useOnboardingState());
    expect(result.current.showWizard).toBe(false);
  });

  it('skipOnboarding define showWizard como false e persiste flag', () => {
    const { result } = renderHook(() => useOnboardingState());
    act(() => { result.current.skipOnboarding(); });
    expect(result.current.showWizard).toBe(false);
    expect(localStorageMock.getItem('fff_onboarding_done')).toBe('true');
  });

  it('currentStep começa em 1', () => {
    const { result } = renderHook(() => useOnboardingState());
    expect(result.current.currentStep).toBe(1);
  });

  it('nextStep avança o step', () => {
    const { result } = renderHook(() => useOnboardingState());
    act(() => { result.current.nextStep(); });
    expect(result.current.currentStep).toBe(2);
  });

  it('nextStep no step 3 chama completeOnboarding', () => {
    const { result } = renderHook(() => useOnboardingState());
    act(() => { result.current.nextStep(); }); // → 2
    act(() => { result.current.nextStep(); }); // → 3
    act(() => { result.current.nextStep(); }); // → completo
    expect(result.current.showWizard).toBe(false);
  });
});
```

- [ ] **Step 7.2: Correr os testes para confirmar que falham**

```bash
npx vitest run src/features/onboarding/useOnboardingState.test.ts
```

Esperado: FAIL — `Cannot find module './useOnboardingState'`.

- [ ] **Step 7.3: Implementar useOnboardingState.ts**

```typescript
// src/features/onboarding/useOnboardingState.ts
import { useState } from 'react';

const STORAGE_KEY = 'fff_onboarding_done';
const TOTAL_STEPS = 3;

export interface OnboardingState {
  showWizard: boolean;
  currentStep: number;
  nextStep: () => void;
  skipOnboarding: () => void;
  completeOnboarding: () => void;
}

export const useOnboardingState = (): OnboardingState => {
  const isDone = () => {
    try {
      return localStorage.getItem(STORAGE_KEY) === 'true';
    } catch {
      return false;
    }
  };

  const [showWizard, setShowWizard] = useState<boolean>(!isDone());
  const [currentStep, setCurrentStep] = useState<number>(1);

  const completeOnboarding = () => {
    try {
      localStorage.setItem(STORAGE_KEY, 'true');
    } catch {}
    setShowWizard(false);
  };

  const skipOnboarding = () => {
    completeOnboarding();
  };

  const nextStep = () => {
    if (currentStep >= TOTAL_STEPS) {
      completeOnboarding();
    } else {
      setCurrentStep((s) => s + 1);
    }
  };

  return { showWizard, currentStep, nextStep, skipOnboarding, completeOnboarding };
};
```

- [ ] **Step 7.4: Correr os testes para confirmar que passam**

```bash
npx vitest run src/features/onboarding/useOnboardingState.test.ts
```

Esperado: PASS em todos os 7 testes.

- [ ] **Step 7.5: Escrever os testes do EmptyState**

```typescript
// src/features/onboarding/EmptyState.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { EmptyState } from './EmptyState';

describe('EmptyState', () => {
  it('renderiza o título e descrição', () => {
    render(
      <EmptyState
        title="Sem contas"
        description="Crie a sua primeira conta para começar."
        ctaLabel="Criar conta"
        onCta={vi.fn()}
      />
    );
    expect(screen.getByText('Sem contas')).toBeInTheDocument();
    expect(screen.getByText('Crie a sua primeira conta para começar.')).toBeInTheDocument();
  });

  it('chama onCta ao clicar no botão CTA', () => {
    const onCta = vi.fn();
    render(
      <EmptyState
        title="Sem contas"
        description="Crie a sua primeira conta."
        ctaLabel="Criar conta"
        onCta={onCta}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: /criar conta/i }));
    expect(onCta).toHaveBeenCalledOnce();
  });

  it('renderiza sem botão CTA quando onCta não é fornecido', () => {
    render(
      <EmptyState
        title="Sem dados"
        description="Nenhum dado disponível."
      />
    );
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('renderiza o icon quando fornecido', () => {
    render(
      <EmptyState
        title="Sem objetivos"
        description="Crie o seu primeiro objetivo."
        icon={<span data-testid="custom-icon">🎯</span>}
      />
    );
    expect(screen.getByTestId('custom-icon')).toBeInTheDocument();
  });
});
```

- [ ] **Step 7.6: Correr os testes para confirmar que falham**

```bash
npx vitest run src/features/onboarding/EmptyState.test.tsx
```

Esperado: FAIL — `Cannot find module './EmptyState'`.

- [ ] **Step 7.7: Implementar EmptyState.tsx**

```typescript
// src/features/onboarding/EmptyState.tsx
import React from 'react';
import { Button } from '../../components/ui/button';

interface EmptyStateProps {
  title: string;
  description: string;
  ctaLabel?: string;
  onCta?: () => void;
  icon?: React.ReactNode;
  className?: string;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  title,
  description,
  ctaLabel,
  onCta,
  icon,
  className = '',
}) => {
  return (
    <div
      className={`flex flex-col items-center justify-center py-16 px-6 text-center space-y-4 ${className}`}
      data-testid="empty-state"
    >
      {icon && (
        <div className="w-16 h-16 flex items-center justify-center text-4xl text-muted-foreground">
          {icon}
        </div>
      )}
      <h3 className="text-lg font-semibold text-foreground">{title}</h3>
      <p className="text-sm text-muted-foreground max-w-sm">{description}</p>
      {ctaLabel && onCta && (
        <Button onClick={onCta} variant="default" className="mt-2">
          {ctaLabel}
        </Button>
      )}
    </div>
  );
};
```

- [ ] **Step 7.8: Correr os testes para confirmar que passam**

```bash
npx vitest run src/features/onboarding/EmptyState.test.tsx
```

Esperado: PASS em todos os 4 testes.

- [ ] **Step 7.9: Escrever os testes do OnboardingWizard**

```typescript
// src/features/onboarding/OnboardingWizard.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { OnboardingWizard } from './OnboardingWizard';

describe('OnboardingWizard', () => {
  const defaultProps = {
    currentStep: 1,
    onNext: vi.fn(),
    onSkip: vi.fn(),
    onCreateAccount: vi.fn(),
    onSeedCategories: vi.fn(),
  };

  it('renderiza o passo 1 (criar conta)', () => {
    render(<OnboardingWizard {...defaultProps} currentStep={1} />);
    expect(screen.getByText(/criar.*conta/i)).toBeInTheDocument();
  });

  it('renderiza o passo 2 (categorias)', () => {
    render(<OnboardingWizard {...defaultProps} currentStep={2} />);
    expect(screen.getByText(/categorias/i)).toBeInTheDocument();
  });

  it('renderiza o passo 3 (primeira transação)', () => {
    render(<OnboardingWizard {...defaultProps} currentStep={3} />);
    expect(screen.getByText(/transaç/i)).toBeInTheDocument();
  });

  it('botão "Saltar" chama onSkip', () => {
    const onSkip = vi.fn();
    render(<OnboardingWizard {...defaultProps} onSkip={onSkip} />);
    fireEvent.click(screen.getByRole('button', { name: /saltar/i }));
    expect(onSkip).toHaveBeenCalledOnce();
  });

  it('botão "Próximo" chama onNext', () => {
    const onNext = vi.fn();
    render(<OnboardingWizard {...defaultProps} onNext={onNext} currentStep={1} />);
    fireEvent.click(screen.getByRole('button', { name: /próximo|continuar/i }));
    expect(onNext).toHaveBeenCalledOnce();
  });

  it('mostra indicador de progresso (passo N de 3)', () => {
    render(<OnboardingWizard {...defaultProps} currentStep={2} />);
    expect(screen.getByText(/2.*3|passo 2/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 7.10: Correr os testes para confirmar que falham**

```bash
npx vitest run src/features/onboarding/OnboardingWizard.test.tsx
```

Esperado: FAIL — `Cannot find module './OnboardingWizard'`.

- [ ] **Step 7.11: Implementar OnboardingWizard.tsx**

```typescript
// src/features/onboarding/OnboardingWizard.tsx
import React from 'react';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '../../components/ui/card';

const TOTAL_STEPS = 3;

interface OnboardingWizardProps {
  currentStep: number;
  onNext: () => void;
  onSkip: () => void;
  onCreateAccount: () => void;
  onSeedCategories: () => Promise<void>;
  className?: string;
}

const stepContent: Record<number, { title: string; description: string }> = {
  1: {
    title: 'Criar a sua primeira conta',
    description:
      'Registe uma conta bancária ou de poupança para começar a acompanhar as suas finanças.',
  },
  2: {
    title: 'Categorias PT prontas a usar',
    description:
      'Temos categorias pré-definidas em português para facilitar a classificação das suas transações. Pode personalizá-las a qualquer momento.',
  },
  3: {
    title: 'Primeira transação (opcional)',
    description:
      'Registe a sua primeira receita ou despesa. Pode saltar e fazê-lo mais tarde.',
  },
};

export const OnboardingWizard: React.FC<OnboardingWizardProps> = ({
  currentStep,
  onNext,
  onSkip,
  onCreateAccount,
  onSeedCategories,
  className = '',
}) => {
  const step = stepContent[currentStep] ?? stepContent[1];

  const handleNext = async () => {
    if (currentStep === 1) {
      onCreateAccount();
    } else if (currentStep === 2) {
      await onSeedCategories();
    }
    onNext();
  };

  return (
    <Card className={`w-full max-w-md mx-auto shadow-xl border-0 bg-gradient-card ${className}`}>
      <CardHeader className="text-center space-y-2">
        <p className="text-xs text-muted-foreground uppercase tracking-wide">
          Passo {currentStep} de {TOTAL_STEPS}
        </p>
        <div className="flex justify-center gap-1.5 mb-2" role="progressbar" aria-valuenow={currentStep} aria-valuemax={TOTAL_STEPS}>
          {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
            <div
              key={i}
              className={`h-1.5 rounded-full transition-all ${
                i < currentStep ? 'bg-primary w-8' : 'bg-muted w-4'
              }`}
            />
          ))}
        </div>
        <CardTitle className="text-xl font-bold">{step.title}</CardTitle>
      </CardHeader>

      <CardContent>
        <p className="text-sm text-muted-foreground text-center">{step.description}</p>
      </CardContent>

      <CardFooter className="flex justify-between gap-2">
        <Button variant="ghost" onClick={onSkip} className="text-muted-foreground">
          Saltar
        </Button>
        <Button onClick={handleNext}>
          {currentStep === TOTAL_STEPS ? 'Concluir' : 'Próximo'}
        </Button>
      </CardFooter>
    </Card>
  );
};
```

- [ ] **Step 7.12: Correr os testes do OnboardingWizard para confirmar que passam**

```bash
npx vitest run src/features/onboarding/OnboardingWizard.test.tsx
```

Esperado: PASS em todos os 6 testes.

- [ ] **Step 7.13: Criar o ficheiro index.ts com os re-exports públicos**

```typescript
// src/features/onboarding/index.ts
export { useOnboardingState } from './useOnboardingState';
export type { OnboardingState } from './useOnboardingState';
export { EmptyState } from './EmptyState';
export { OnboardingWizard } from './OnboardingWizard';
```

- [ ] **Step 7.14: Correr todos os testes do onboarding**

```bash
npx vitest run src/features/onboarding/
```

Esperado: PASS em todos os testes (7 + 4 + 6 = 17 testes).

- [ ] **Step 7.15: Verificar compilação TypeScript**

```bash
npx tsc --noEmit
```

Esperado: sem erros.

- [ ] **Step 7.16: Commit**

```bash
git add src/features/onboarding/
git commit -m "feat(onboarding): scaffold hybrid onboarding — useOnboardingState, EmptyState, OnboardingWizard"
```

---

## Verificação Final

Após todas as tasks:

- [ ] **Correr todos os testes**

```bash
npx vitest run
```

Esperado: todos os testes passam. Testes novos adicionados: ~26 (Task 1: 3, Task 5: 3, Task 6: 4, Task 7: 17 — subtotal, pode variar com os testes de OAuth adicionados a LoginForm.test.tsx).

- [ ] **Verificar compilação limpa**

```bash
npx tsc --noEmit
```

Esperado: sem erros.

- [ ] **Confirmar que nenhum ficheiro de debug sobrou**

```bash
grep -r "DirectLoginTest\|\[DEBUG\]\|Password.*console\|console\.log.*password\|TestPage\|AuthTest\|test-supabase" src/ --include="*.ts" --include="*.tsx" -l
```

Esperado: sem resultados (ou apenas este ficheiro de plano em docs/).

- [ ] **Confirmar que a rota /test não existe em App.tsx**

```bash
grep -n "/test" src/App.tsx
```

Esperado: sem resultados com rota `/test`.

- [ ] **Confirmar que os botões OAuth estão disabled em LoginForm**

```bash
grep -n "disabled" src/components/auth/LoginForm.tsx
```

Esperado: os três botões OAuth têm `disabled` como prop estática.

- [ ] **Confirmar que o fallback timer está em 8000ms**

```bash
grep -n "8000\|8s" src/contexts/AuthContext.tsx
```

Esperado: uma linha com `8000`.
