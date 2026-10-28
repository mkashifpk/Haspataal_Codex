import fs from 'node:fs';
// Append only meaningful checkpoints; no credentials or real patient information.
const note=process.argv[2];if(!note)throw Error('Checkpoint note required');
fs.appendFileSync('handoff.md','\nBed matrix checkpoint28Oct (Codex): '+note+'\n');
