@mode:serial
Feature: Light Adjuster

  Background:
    Given I am logged in as Gamemaster
    And no actors have light sources

  Scenario: Adjuster opens and shows buttons
    When I open the Light Adjuster
    Then the Light Adjuster should be visible
    And the Light Adjuster should show the button grid

  Scenario: Adjusting with no active lights shows status
    When I open the Light Adjuster
    And I adjust light timers by "-1 min"
    Then the Light Adjuster status should be visible

  Scenario: Adjusting with active lights updates status and timers
    Given "Creeg Greythorn (GM)" has a lit torch
    When I open the Light Adjuster
    And I adjust light timers by "+1 min"
    Then the Light Adjuster status should be visible
    And the Light Adjuster timer summary should be visible

  Scenario: Adjusting affects all active light sources
    Given "Creeg Greythorn (GM)" has a lit torch
    And "Iraga Draguul (1)" has a lit torch
    When I open the Light Adjuster
    And I adjust light timers by "-1 min"
    Then the Light Adjuster timer summary should mention "Creeg Greythorn"
    And the Light Adjuster timer summary should mention "Iraga Draguul"

  # --- Eye tests ---

  Scenario: Describe the adjuster with no active lights
    When I open the Light Adjuster
    Then describe the Light Adjuster window

  Scenario: Describe the adjuster after adjusting a lit torch
    Given "Creeg Greythorn (GM)" has a lit torch
    When I open the Light Adjuster
    And I adjust light timers by "-1 min"
    Then describe the Light Adjuster window
