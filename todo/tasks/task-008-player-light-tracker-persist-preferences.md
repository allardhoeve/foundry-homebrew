# Task 008: Player Light Tracker — Persist User Preferences

## Goal
Persist B&W mode and compact mode preferences across sessions using Foundry's client settings API.

## Changes
- [x] Register client settings for `plt-bw-mode` and `plt-compact-mode`
- [x] Load saved preferences in constructor
- [x] Save preferences when toggled
- [x] Apply compact mode class on render (B&W was already applied)

## Verify
- [ ] Toggle B&W and compact, close and reopen — modes restored
- [ ] Reload page, reopen — modes still restored
- [ ] Toggle off, close and reopen — stays off
