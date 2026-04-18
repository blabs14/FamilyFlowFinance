const ACCOUNT_NAME = `E2E Conta ${Date.now()}`;
const ACCOUNT_NAME_BALANCE = `${ACCOUNT_NAME}-balance`;

describe('Accounts', () => {
  beforeEach(() => {
    cy.login();
    cy.visit('/personal/accounts');
  });

  it('creates a new account and shows it in the list', () => {
    cy.get('[data-cy=create-account-btn]').click();
    cy.get('[data-cy=account-name-input]').type(ACCOUNT_NAME);
    cy.get('[data-cy=account-type-select]').click();
    cy.get('[role=option]').contains(/corrente/i).click();
    cy.get('[data-cy=account-submit-btn]').click();
    cy.contains('[data-cy=account-item]', ACCOUNT_NAME).should('exist');
  });

  it('shows account balance', () => {
    cy.get('[data-cy=create-account-btn]').click();
    cy.get('[data-cy=account-name-input]').type(ACCOUNT_NAME_BALANCE);
    cy.get('[data-cy=account-type-select]').click();
    cy.get('[role=option]').contains(/corrente/i).click();
    cy.get('[data-cy=account-balance-input]').type('500');
    cy.get('[data-cy=account-submit-btn]').click();
    cy.get('[data-cy=confirm-dialog-confirm]').click();
    cy.contains('[data-cy=account-item]', ACCOUNT_NAME_BALANCE)
      .should('contain.text', '500');
  });

  after(() => {
    cy.login();
    cy.visit('/personal/accounts');
    cy.get('body').then(($body) => {
      [ACCOUNT_NAME, ACCOUNT_NAME_BALANCE].forEach((name) => {
        if ($body.text().includes(name)) {
          cy.contains('[data-cy=account-item]', name)
            .find('[data-cy=delete-account-btn]')
            .click();
          cy.get('[data-cy=confirm-dialog-confirm]').click();
        }
      });
    });
  });
});
