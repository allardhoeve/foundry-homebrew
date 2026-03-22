Feature: Player Light Tracker

  The Player Light Tracker shows the player's light source using atmospheric
  descriptions and animations. It has two display modes: full mode with an
  animation and header, and compact mode with a character portrait and
  a single status line.

  Background:
    Given I am logged in as Gamemaster
    And no actors have light sources

  # --- Assertion tests ---

  Scenario: Opening the tracker shows the full interface
    When I open the Player Light Tracker
    Then the tracker window should be visible
    And the tracker should have the title "Light Tracker"
    And the tracker should show a status message
    And the tracker should show an animation area

  Scenario: Compact mode replaces the animation with the active portrait
    Given the Player Light Tracker is open
    When I click the compact toggle
    Then the animation area should be hidden
    And only the active character portrait should be visible

  Scenario: Clicking the compact portrait opens the character selector
    Given the Player Light Tracker is open in compact mode
    When I click the character portrait
    Then the character selector popup should be visible

  Scenario: Toggling compact mode back restores the animation
    Given the Player Light Tracker is open in compact mode
    When I click the compact toggle
    Then the tracker should show an animation area
    And the character portrait should not be visible

  Scenario: Black and white mode desaturates the tracker
    Given the Player Light Tracker is open
    When I click the black and white toggle
    Then the tracker should have the desaturated style applied

  Scenario: Closing and reopening the tracker preserves compact mode
    Given the Player Light Tracker is open in compact mode
    When I close the Player Light Tracker
    And I open the Player Light Tracker
    Then the animation area should be hidden
    And only the active character portrait should be visible

  # --- Light source states ---

  Scenario: Torch shows bright state
    Given "Creeg Greythorn (GM)" has a lit torch
    And the Player Light Tracker is open
    Then the tracker status should say "Your light shines brightly"
    And the tracker should show a torch animation

  Scenario: Torch with little time left shows fading state
    Given "Creeg Greythorn (GM)" has a lit torch with "10:00" left
    And the Player Light Tracker is open
    Then the tracker status should say "Your light starts to fade"

  Scenario: Oil lamp shows bright state
    Given "Creeg Greythorn (GM)" has a lit oil lamp
    And the Player Light Tracker is open
    Then the tracker status should say "Your light shines brightly"
    And the tracker should show a torch animation

  Scenario: Oil lamp with moderate time left shows good state
    Given "Creeg Greythorn (GM)" has a lit oil lamp with "20:00" left
    And the Player Light Tracker is open
    Then the tracker status should say "Your light shines well"

  Scenario: Light spell shows bright state with spell animation
    Given "Creeg Greythorn (GM)" has a lit light spell
    And the Player Light Tracker is open
    Then the tracker status should say "Your light shines brightly"
    And the tracker should show a spell animation

  Scenario: Light spell with little time left shows fading state
    Given "Creeg Greythorn (GM)" has a lit light spell with "10:00" left
    And the Player Light Tracker is open
    Then the tracker status should say "Your light starts to fade"

  Scenario: No light sources shows darkness
    Given the Player Light Tracker is open
    Then the tracker status should say "The darkness engulfs you"
    And the tracker should not show an animation

  # --- Party light ---

  Scenario: Party member's torch shows party light message
    Given "Creeg Greythorn (GM)" has no light sources
    And "Elbin Grizzlegut (GM)" has a lit torch
    And the Player Light Tracker is open
    Then the tracker status should contain "party"

  Scenario: Party light fading
    Given "Creeg Greythorn (GM)" has no light sources
    And "Elbin Grizzlegut (GM)" has a lit torch with "10:00" left
    And the Player Light Tracker is open
    Then the tracker status should say "The party's light is fading"

  # --- Eye tests (structured inspection) ---

  Scenario: Inspect tracker with torch
    Given "Creeg Greythorn (GM)" has a lit torch
    And the Player Light Tracker is open
    Then describe the tracker window

  Scenario: Inspect tracker with oil lamp
    Given "Creeg Greythorn (GM)" has a lit oil lamp
    And the Player Light Tracker is open
    Then describe the tracker window

  Scenario: Inspect tracker with light spell
    Given "Creeg Greythorn (GM)" has a lit light spell
    And the Player Light Tracker is open
    Then describe the tracker window

  Scenario: Inspect tracker in darkness
    Given "Creeg Greythorn (GM)" has no light sources
    And the Player Light Tracker is open
    Then describe the tracker window

  Scenario: Inspect tracker with party light
    Given "Creeg Greythorn (GM)" has no light sources
    And "Elbin Grizzlegut (GM)" has a lit torch
    And the Player Light Tracker is open
    Then describe the tracker window

  Scenario: Inspect tracker compact mode
    Given "Creeg Greythorn (GM)" has a lit torch
    And the Player Light Tracker is open in compact mode
    Then describe the tracker window
