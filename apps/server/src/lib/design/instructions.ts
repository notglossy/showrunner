import type { InstructionsState } from './tokens';

// TODO: Piece D (instructions) implements this file. Signatures are the contract; keep them.

/** The AI's authoring guide: the owner's version, or docs/screen-authoring.md. */
export function getInstructions(): InstructionsState {
  return { text: '', defaultText: '', customised: false, defaultChanged: false };
}

/** Stores the owner's version of the guide. */
export function updateInstructions(_text: string): InstructionsState {
  return getInstructions();
}

/** Drops the owner's version (back to the authoring doc). */
export function resetInstructions(): InstructionsState {
  return getInstructions();
}
