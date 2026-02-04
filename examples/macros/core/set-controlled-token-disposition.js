/*
  Macro: Set Controlled Token Disposition (v13)
  Purpose: Change disposition on all controlled tokens.
  Requirements: One or more controlled tokens on the canvas.
  Notes: Original example for this repo.
*/

if (!canvas?.tokens?.controlled?.length) {
  ui.notifications.warn("Select at least one token.");
  return;
}

let applyChanges = false;

new Dialog({
  title: "Token Disposition",
  content: `
    <form>
      <div class="form-group">
        <label>Disposition:</label>
        <select name="disposition">
          <option value="NONE">No Change</option>
          <option value="HOSTILE">Hostile</option>
          <option value="NEUTRAL">Neutral</option>
          <option value="FRIENDLY">Friendly</option>
        </select>
      </div>
    </form>
  `,
  buttons: {
    apply: {
      icon: "<i class='fas fa-check'></i>",
      label: "Apply",
      callback: () => (applyChanges = true)
    },
    cancel: {
      icon: "<i class='fas fa-times'></i>",
      label: "Cancel"
    }
  },
  default: "apply",
  close: async (html) => {
    if (!applyChanges) return;
    const value = html.find("[name=disposition]")[0]?.value ?? "NONE";
    if (value === "NONE") return;

    const updates = canvas.tokens.controlled.map((t) => ({
      _id: t.document.id,
      disposition: CONST.TOKEN_DISPOSITIONS[value]
    }));

    await canvas.scene.updateEmbeddedDocuments("Token", updates);
  }
}).render(true);
