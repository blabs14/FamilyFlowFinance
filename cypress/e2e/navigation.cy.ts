describe('Personal navigation', () => {
  beforeEach(() => {
    cy.login();
    cy.visit('/personal');
  });

  const clickVisibleTab = (label: string) => {
    cy.get('[role=tablist]:visible')
      .first()
      .contains(label)
      .click();
  };

  it('navigates to accounts', () => {
    clickVisibleTab('Contas');
    cy.url().should('include', '/personal/accounts');
  });

  it('navigates to transactions', () => {
    clickVisibleTab('Transações');
    cy.url().should('include', '/personal/transactions');
  });

  it('navigates to goals', () => {
    clickVisibleTab('Objetivos');
    cy.url().should('include', '/personal/goals');
  });
});
