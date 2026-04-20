@mode:serial
Feature: Party Actor

  Background:
    Given I am logged in as Gamemaster

  Scenario: Party actor can be created and opened
    When I create a Party actor named "Test Party"
    Then the Party sheet should be visible
    And the Party sheet title should contain "Test Party"

  Scenario: Empty state shows drag-and-drop hint
    When I create a Party actor named "Empty Party"
    Then the Party sheet should show the empty state

  Scenario: Player actor can be added as a member
    When I create a Party actor named "Member Party"
    And I add player "Iraga Draguul (1)" to the party
    Then the Party sheet should show member "Iraga Draguul (1)"
    And the Party sheet should show HP for "Iraga Draguul (1)"

  Scenario: Duplicate members are prevented
    When I create a Party actor named "Dedup Party"
    And I add player "Iraga Draguul (1)" to the party
    And I add player "Iraga Draguul (1)" to the party
    Then the Party sheet should show 1 member

  Scenario: Member can be removed
    When I create a Party actor named "Remove Party"
    And I add player "Iraga Draguul (1)" to the party
    And I remove member "Iraga Draguul (1)" from the party
    Then the Party sheet should show the empty state

  Scenario: Clicking member name opens their sheet
    When I create a Party actor named "Click Party"
    And I add player "Iraga Draguul (1)" to the party
    And I click member name "Iraga Draguul (1)"
    Then the character sheet for "Iraga Draguul (1)" should be visible

  # --- Eye tests ---

  Scenario: Describe empty party sheet
    When I create a Party actor named "Eye Test Empty"
    Then describe the Party sheet

  Scenario: Describe party sheet with members
    When I create a Party actor named "Eye Test Full"
    And I add player "Iraga Draguul (1)" to the party
    And I add player "Martin Rast (2)" to the party
    Then describe the Party sheet
