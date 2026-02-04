/*
  Macro: Advance Combat Turn (v13)
  Purpose: End the current combatant's turn if you are GM or owner.
  Requirements: Active combat encounter.
  Notes: Original example for this repo.
*/

if (!game.combat) {
  ui.notifications.warn("No active combat encounter.");
  return;
}

const combatant = game.combat.combatant;
if (!combatant) {
  ui.notifications.warn("No current combatant.");
  return;
}

const isGM = game.user.isGM;
const isOwner = combatant.isOwner;

if (isGM || isOwner) {
  game.combat.nextTurn();
} else {
  ui.notifications.info("You can only advance your own turn.");
}
