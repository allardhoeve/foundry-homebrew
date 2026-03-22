@mode:serial
Feature: Encounter Roller

  Background:
    Given I am logged in as Gamemaster
    And the encounter roller settings are reset

  Scenario: Roller opens with pick mode when roll mode is unset
    When I open the Encounter Roller
    Then the Encounter Roller should be visible
    And the Encounter Roller should show the roll mode picker

  Scenario: Selecting d6-only mode shows the roller with correct buttons
    When I open the Encounter Roller
    And I select roll mode "d6-only"
    Then the Encounter Roller should show the roller
    And the Encounter Roller should show the primary button "Roll Encounter Check"
    And the encounter penalty display should show 0

  Scenario: Selecting both mode shows the roller with d12 primary button
    When I open the Encounter Roller
    And I select roll mode "both"
    Then the Encounter Roller should show the roller
    And the Encounter Roller should show the primary button "1d12"

  Scenario: Roller opens directly when roll mode is already set
    Given the encounter roll mode is "d6-only"
    When I open the Encounter Roller
    Then the Encounter Roller should show the roller

  Scenario: Penalty value is reflected in the roller
    Given the Minotaur penalty is 4
    And the encounter roll mode is "d6-only"
    When I open the Encounter Roller
    Then the encounter penalty display should show 4

  Scenario: Cog button re-opens the roll mode picker
    Given the encounter roll mode is "d6-only"
    When I open the Encounter Roller
    And I click the Encounter Roller settings button
    Then the Encounter Roller should show the roll mode picker

  # --- Eye tests ---

  Scenario: Describe the picker state
    When I open the Encounter Roller
    Then describe the Encounter Roller window

  Scenario: Describe the roller state in d6-only mode
    Given the encounter roll mode is "d6-only"
    And the Minotaur penalty is 2
    When I open the Encounter Roller
    Then describe the Encounter Roller window

  Scenario: Describe the roller state in 1d12 mode
    Given the encounter roll mode is "both"
    And the Minotaur penalty is 4
    When I open the Encounter Roller
    Then describe the Encounter Roller window
