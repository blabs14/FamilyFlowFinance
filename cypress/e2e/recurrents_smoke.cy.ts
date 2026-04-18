describe('Recorrentes - Smoke', () => {
  it('abre página e mostra lista', () => {
    cy.login();
    cy.visit('/personal/recorrentes');
    cy.contains('Recorrentes');
  });

  it('mostra dialog e previsualização', () => {
    cy.login();
    cy.visit('/personal/recorrentes');
    cy.get('[data-cy=create-rule-btn]').click();
    cy.get('[data-cy=rule-description-input]').type('Teste Netflix');
    cy.get('[data-cy=rule-amount-input]').clear().type('999');
    cy.get('input[type="date"]').first().should('exist');
    cy.get('[data-cy=rule-preview]').should('contain.text', 'Próximos 3 lançamentos');
    cy.get('[data-cy=cancel-rule-btn]').click();
  });
}); 
