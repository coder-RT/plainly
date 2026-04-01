/**
 * Central prompt registry.
 *
 * To add a new mode:
 *   1. Create prompts/mymode.js and export default a string
 *   2. Add it here: export { default as mymode } from './mymode.js'
 *   3. Add a mode button in sidepanel.html
 *   4. The rest of the code picks it up automatically via SYSTEM_PROMPTS[mode]
 *
 * To remove a mode: delete the export and its button.
 * To reset a mode: restore the string in its individual file.
 */
export { default as adhd }     from './adhd.js';
export { default as eli5 }     from './eli5.js';
export { default as detailed } from './detailed.js';
