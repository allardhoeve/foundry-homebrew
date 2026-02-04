/*
  Macro: List Modules (v13)
  Purpose: Display a list of installed modules and enabled state.
  Requirements: None.
  Notes: Original example for this repo.
*/

const modules = Array.from(game.modules.values())
  .map((m) => `${m.id}: ${m.active ? "Enabled" : "Disabled"}`)
  .join("\n");

new Dialog({
  title: "Installed Modules",
  content: `
    <textarea style="height: 420px; width: 100%;" readonly>
${modules}
    </textarea>
  `,
  buttons: {
    copy: {
      label: "Copy",
      callback: async () => {
        try {
          await navigator.clipboard.writeText(modules);
          ui.notifications.info("Copied to clipboard.");
        } catch (err) {
          console.warn(err);
          ui.notifications.warn("Clipboard copy failed.");
        }
      }
    },
    close: { label: "Close" }
  },
  default: "close"
}).render(true);
