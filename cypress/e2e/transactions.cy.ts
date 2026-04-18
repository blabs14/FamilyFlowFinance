const TX_DESC = `E2E Transação ${Date.now()}`;
const TX_DESC_FILTER = `${TX_DESC}-filter`;
const ACCOUNT_NAME = `E2E TX Account ${Date.now()}`;

function ensureFundingAccount() {
  cy.visit('/personal/accounts');
  cy.get('body').then(($body) => {
    if (!$body.text().includes(ACCOUNT_NAME)) {
      cy.get('[data-cy=create-account-btn]').click();
      cy.get('[data-cy=account-name-input]').type(ACCOUNT_NAME);
      cy.get('[data-cy=account-type-select]').click();
      cy.get('[role=option]').contains(/corrente/i).click();
      cy.get('[data-cy=account-submit-btn]').click();
    }
  });
  cy.contains('[data-cy=account-item]', ACCOUNT_NAME).should('exist');
}

function createExpenseTransaction(description: string) {
  cy.visit('/personal/transactions');
  cy.get('[data-cy=create-transaction-btn]').click();
  cy.get('[data-cy=transaction-description-input]').type(description);
  cy.get('[data-cy=transaction-amount-input]').clear().type('42.50');
  cy.get('[data-cy=transaction-account-select]').click();
  cy.get('[role=option]', { timeout: 10000 }).contains(ACCOUNT_NAME).click();
  cy.get('body').then(($body) => {
    if ($body.find('[data-cy=transaction-category-select]').length) {
      cy.get('[data-cy=transaction-category-select]').click();
      cy.get('[role=option]', { timeout: 10000 }).first().click();
    } else {
      cy.get('[data-cy=create-category-inline-btn]').click();
      cy.get('[data-cy=new-category-name-input]').type(`Categoria ${description}`);
      cy.get('[data-cy=create-category-confirm-btn]').click();
    }
  });
  cy.get('[data-cy=transaction-submit-btn]').click();
}

describe('Transactions', () => {
  beforeEach(() => {
    cy.login();
    ensureFundingAccount();
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

    cy.visit('/personal/accounts');
    cy.get('body').then(($body) => {
      if ($body.text().includes(ACCOUNT_NAME)) {
        cy.contains('[data-cy=account-item]', ACCOUNT_NAME)
          .find('[data-cy=delete-account-btn]')
          .click();
        cy.get('[data-cy=confirm-dialog-confirm]').click();
      }
    });
  });
});
