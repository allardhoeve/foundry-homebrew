Feature: Actor visibility in Player Light Tracker

  The character selector in the Player Light Tracker shows only actors
  owned by the current user. The GM sees all actors; players see only
  their own.

  Scenario: GM sees all player actors in the character selector
    Given I am logged in as Gamemaster
    And the Player Light Tracker is open
    Then the character selector should show 6 actors

  Scenario: Player sees only their own actors
    Given I am logged in as Player 1
    And the Player Light Tracker is open
    Then the character selector should show 2 actors
    And the character selector should include "Iraga Draguul (1)"
    And the character selector should include "Jorbin Ironhelm (1)"

  Scenario: Second player sees only their own actors
    Given I am logged in as Player 2
    And the Player Light Tracker is open
    Then the character selector should show 2 actors
    And the character selector should include "Martin Rast (2)"
    And the character selector should include "Ralina Biggins (2)"
