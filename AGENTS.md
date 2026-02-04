## Instructions for code
- Our Foundry version is 13 build 351.
- Only develop against the V2 Application framework (`foundry.applications.api.ApplicationV2`).

### Please note deprecations 
- The renderChatMessage hook is deprecated. Please use renderChatMessageHTML instead, which now passes an HTMLElement argument instead of jQuery.