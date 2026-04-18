const ACCOUNT_NAME = `E2E Goal Account ${Date.now()}`;
const GOAL_NAME = `E2E Goal ${Date.now()}`;

function createFundingAccount() {
  cy.visit('/personal/accounts');
  cy.get('body').then(($body) => {
    if (!$body.text().includes(ACCOUNT_NAME)) {
      cy.get('[data-cy=create-account-btn]').click();
      cy.get('[data-cy=account-name-input]').type(ACCOUNT_NAME);
      cy.get('[data-cy=account-type-select]').click();
      cy.get('[role=option]').contains(/corrente/i).click();
      cy.get('[data-cy=account-balance-input]').type('300');
      cy.get('[data-cy=account-submit-btn]').click();
      cy.get('[data-cy=confirm-dialog-confirm]').click();
    }
  });
  cy.contains('[data-cy=account-item]', ACCOUNT_NAME).should('exist');
}

describe('Goals', () => {
  beforeEach(() => {
    cy.login();
  });

  it('creates a new goal', () => {
    cy.visit('/personal/goals');
    cy.get('[data-cy=create-goal-btn]').click();
    cy.get('[data-cy=goal-name-input]').type(GOAL_NAME);
    cy.get('[data-cy=goal-target-input]').clear().type('200');
    cy.get('[data-cy=goal-submit-btn]').click();
    cy.contains('[data-cy=goal-card]', GOAL_NAME).should('exist');
  });

  it('allocates and then deallocates funds from a goal', () => {
    createFundingAccount();

    cy.visit('/personal/goals');
    cy.get('[data-cy=create-goal-btn]').click();
    cy.get('[data-cy=goal-name-input]').type(`${GOAL_NAME}-flow`);
    cy.get('[data-cy=goal-target-input]').clear().type('200');
    cy.get('[data-cy=goal-submit-btn]').click();

    cy.contains('[data-cy=goal-card]', `${GOAL_NAME}-flow`)
      .within(() => {
        cy.get('[data-cy=allocate-goal-btn]').click();
      });

    cy.get('[data-cy=allocate-account-select]').click();
    cy.get('[role=option]', { timeout: 10000 }).contains(ACCOUNT_NAME).click();
    cy.get('[data-cy=allocate-amount-input]').type('50');
    cy.get('[data-cy=allocate-submit-btn]').click();

    cy.contains('[data-cy=goal-card]', `${GOAL_NAME}-flow`).should('contain.text', '50');

    cy.contains('[data-cy=goal-card]', `${GOAL_NAME}-flow`)
      .within(() => {
        cy.get('[data-cy=deallocate-goal-btn]').click();
      });

    cy.get('[data-cy=deallocate-account-select]').click();
    cy.get('[role=option]', { timeout: 10000 }).contains(ACCOUNT_NAME).click();
    cy.get('[data-cy=deallocate-amount-input]').type('20');
    cy.get('[data-cy=deallocate-submit-btn]').click();

    cy.visit('/personal/goals');
    cy.contains('[data-cy=goal-card]', `${GOAL_NAME}-flow`).should('contain.text', '30');
  });

  after(() => {
    cy.login();

    cy.visit('/personal/goals');
    cy.get('body').then(($body) => {
      [GOAL_NAME, `${GOAL_NAME}-flow`].forEach((name) => {
        if ($body.text().includes(name)) {
          cy.contains('[data-cy=goal-card]', name)
            .find('[data-cy=delete-goal-btn]')
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
