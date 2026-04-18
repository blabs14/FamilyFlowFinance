/// <reference types="cypress" />

declare global {
  namespace Cypress {
    interface Chainable {
      login(email?: string, password?: string): Chainable<void>;
      logout(): Chainable<void>;
    }
  }
}

Cypress.Commands.add('login', (
  email = Cypress.env('email'),
  password = Cypress.env('password')
) => {
  cy.session([email, password], () => {
    cy.visit('/login');
    cy.get('[data-cy=email-input]').type(email);
    cy.get('[data-cy=password-input]').type(password);
    cy.get('[data-cy=login-btn]').click();
    cy.url().should('not.include', '/login');
  });
});

Cypress.Commands.add('logout', () => {
  cy.clearLocalStorage();
  cy.clearCookies();
});

export {};
