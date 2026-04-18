import { defineConfig } from 'cypress';

export default defineConfig({
  e2e: {
    baseUrl: process.env.CYPRESS_BASE_URL || 'http://localhost:8081',
    specPattern: 'cypress/e2e/**/*.cy.{ts,tsx}',
    supportFile: 'cypress/support/e2e.ts',
    env: {
      email: process.env.CYPRESS_TEST_EMAIL,
      password: process.env.CYPRESS_TEST_PASSWORD,
    },
  },
}); 
