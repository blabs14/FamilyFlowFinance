const TX_DESC = `E2E Transação ${Date.now()}`;
const TX_DESC_FILTER = `${TX_DESC}-filter`;

function createExpenseTransaction(description: string) {
  cy.get('[data-cy=create-transaction-btn]').click();
  cy.get('[data-cy=transaction-description-input]').type(description);
  cy.get('[data-cy=transaction-amount-input]').clear().type('42.50');
  cy.get('[data-cy=transaction-account-select]').click();
  cy.get('[role=option]').first().click();
  cy.get('[data-cy=transaction-category-select]').click();
  cy.get('[role=option]').first().click();
  cy.get('[data-cy=transaction-submit-btn]').click();
}

describe('Transactions', () => {
  beforeEach(() => {
    cy.login();
    cy.visit('/personal/transactions');
  });

  it('creates a despesa transaction and shows it in the list', () => {
    createExpenseTransaction(TX_DESC);
    cy.contains('[data-cy=transaction-item]', TX_DESC).should('exist');
  });

  it('filters transactions by type', () => {
    createExpenseTransaction(TX_DESC_FILTER);
    cy.get('[data-cy=transaction-type-filter]').click();
    cy.get('[role=option]').contains(/despesas/i).click();
    cy.contains('[data-cy=transaction-item]', TX_DESC_FILTER).should('exist');
    cy.get('[data-cy=transaction-item]').each(($item) => {
      cy.wrap($item).should('not.contain.text', '+');
    });
  });

  after(() => {
    cy.login();
    cy.visit('/personal/transactions');
    cy.get('body').then(($body) => {
      [TX_DESC, TX_DESC_FILTER].forEach((description) => {
        if ($body.text().includes(description)) {
          cy.contains('[data-cy=transaction-item]', description)
            .find('[aria-label="Eliminar transação"]')
            .click();
          cy.get('[data-cy=confirm-dialog-confirm]').click();
        }
      });
    });
  });
});
