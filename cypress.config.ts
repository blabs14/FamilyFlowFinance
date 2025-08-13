import { defineConfig } from 'cypress';

export default defineConfig({
  e2e: {
    baseUrl: process.env.CYPRESS_BASE_URL || 'http://localhost:8081',
    specPattern: 'cypress/e2e/**/*.cy.{ts,tsx}',
    supportFile: false,
  },
}); 