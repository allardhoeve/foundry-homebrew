Feature: Window headers

  Foundry owns the window header and adds to it between versions (v14 added a
  controls menu with Detach and Attach). Our windows restyle that header, so
  these checks catch the day Foundry adds something our layout did not expect:
  buttons must stay gathered at the edges, never floating in the middle, and
  the controls menu must not list anything twice.

  Background:
    Given I am logged in as Gamemaster

  Scenario Outline: The <window> header keeps its buttons at the edges
    When I open the "<window>" window
    Then no button in the "<window>" header floats away from the edges

    Examples:
      | window           |
      | Light Tracker    |
      | Light Adjuster   |
      | Scarlet Minotaur |
      | Asset Browser    |
      | Crawling Clock   |

  Scenario Outline: The <window> controls menu lists each entry once
    When I open the "<window>" window
    And I open the controls menu of the "<window>" window
    Then the controls menu should list no entry twice

    Examples:
      | window           |
      | Light Tracker    |
      | Light Adjuster   |
      | Scarlet Minotaur |
      | Asset Browser    |
      | Crawling Clock   |
