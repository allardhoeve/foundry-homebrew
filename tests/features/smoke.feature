Feature: Module loads correctly

  Scenario: Foundry loads the module without errors
    Given I am logged in as Gamemaster
    And the canvas is ready
    Then the module "foundry-homebrew" should be active
    And there should be no console errors
