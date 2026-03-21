import { createBdd } from 'playwright-bdd';
import { test } from '../support/fixtures.js';

const { Given } = createBdd(test);

// --- Light source templates ---

const LIGHT_TEMPLATES = {
  torch: {
    type: 'Basic',
    name: 'Torch',
    system: {
      isPhysical: true,
      light: {
        active: true,
        hasBeenUsed: false,
        isSource: true,
        longevityMins: 60,
        remainingSecs: 3600,
        template: 'torch',
      },
    },
  },
  'oil lamp': {
    type: 'Basic',
    name: 'Oil Lamp',
    system: {
      isPhysical: true,
      light: {
        active: true,
        hasBeenUsed: false,
        isSource: true,
        longevityMins: 60,
        remainingSecs: 3600,
        template: 'lantern',
      },
    },
  },
  'light spell': {
    type: 'Basic',
    name: 'Light Spell',
    system: {
      isPhysical: true,
      light: {
        active: true,
        hasBeenUsed: false,
        isSource: true,
        longevityMins: 60,
        remainingSecs: 3600,
        template: 'lightSpellNear',
      },
    },
  },
};

/**
 * Removes all active light sources from an actor, then optionally adds one.
 */
async function arrangeLight(page, actorName, sourceType, remainingSecs) {
  const template = sourceType ? structuredClone(LIGHT_TEMPLATES[sourceType]) : null;
  await page.evaluate(async ({ actorName, template, remainingSecs }) => {
    const actor = game.actors.getName(actorName);
    if (!actor) throw new Error(`Actor "${actorName}" not found`);

    // Remove all existing light sources
    const lights = actor.items.filter(i => i.system?.light?.isSource);
    if (lights.length > 0) {
      await actor.deleteEmbeddedDocuments('Item', lights.map(i => i._id));
    }

    // Add the new one if requested
    if (template) {
      if (remainingSecs != null) {
        template.system.light.remainingSecs = remainingSecs;
        // longevityMins stays at the original total duration (e.g. 60 mins for a torch)
        // so the fraction remainingSecs / (longevityMins * 60) reflects how much is left
      }
      await actor.createEmbeddedDocuments('Item', [template]);
    }
  }, {
    actorName,
    template,
    remainingSecs,
  });
}

function parseTime(timeStr) {
  const [mins, secs] = timeStr.split(':').map(Number);
  return mins * 60 + secs;
}

// --- Steps ---

Given('no actors have light sources', async ({ session }) => {
  await session.page.evaluate(async () => {
    for (const actor of game.actors.filter(a => a.type === 'Player')) {
      const lights = actor.items.filter(i => i.system?.light?.isSource);
      if (lights.length > 0) {
        await actor.deleteEmbeddedDocuments('Item', lights.map(i => i._id));
      }
    }
  });
});

Given('{string} has a lit torch', async ({ session }, actorName) => {
  await arrangeLight(session.page, actorName, 'torch');
});

Given('{string} has a lit torch with {string} left', async ({ session }, actorName, time) => {
  await arrangeLight(session.page, actorName, 'torch', parseTime(time));
});

Given('{string} has a lit oil lamp', async ({ session }, actorName) => {
  await arrangeLight(session.page, actorName, 'oil lamp');
});

Given('{string} has a lit oil lamp with {string} left', async ({ session }, actorName, time) => {
  await arrangeLight(session.page, actorName, 'oil lamp', parseTime(time));
});

Given('{string} has a lit light spell', async ({ session }, actorName) => {
  await arrangeLight(session.page, actorName, 'light spell');
});

Given('{string} has a lit light spell with {string} left', async ({ session }, actorName, time) => {
  await arrangeLight(session.page, actorName, 'light spell', parseTime(time));
});

Given('{string} has no light sources', async ({ session }, actorName) => {
  await arrangeLight(session.page, actorName, null);
});
