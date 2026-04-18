describe('Auth flow', () => {
  it('redirects unauthenticated users from protected routes to /login', () => {
    cy.visit('/app');
    cy.url().should('include', '/login');
  });

  it('logs in with valid credentials and lands on a protected page', () => {
    cy.visit('/login');
    cy.get('[data-cy=email-input]').type(Cypress.env('email'));
    cy.get('[data-cy=password-input]').type(Cypress.env('password'));
    cy.get('[data-cy=login-btn]').click();
    cy.url().should('not.include', '/login');
    cy.get('[data-cy=app-nav]').should('exist');
  });

  it('shows an error message with wrong credentials', () => {
    cy.visit('/login');
    cy.get('[data-cy=email-input]').type('wrong@example.com');
    cy.get('[data-cy=password-input]').type('wrongpassword');
    cy.get('[data-cy=login-btn]').click();
    cy.url().should('include', '/login');
    cy.get('[data-cy=login-error], [role=alert]').should('be.visible');
  });

  it('redirects to /login after logout', () => {
    cy.login();
    cy.visit('/app');
    cy.get('[data-cy=logout-btn]').click();
    cy.url().should('include', '/login');
  });
});
