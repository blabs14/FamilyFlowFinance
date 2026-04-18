import './commands';

Cypress.on('uncaught:exception', (err) => {
  if (err.message.includes('ResizeObserver loop completed with undelivered notifications')) {
    return false;
  }
});

beforeEach(() => {
  cy.clearLocalStorage();
  cy.clearCookies();
});
