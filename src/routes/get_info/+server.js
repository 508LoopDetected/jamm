import { json } from '@sveltejs/kit';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/** @type {import('./$types').RequestHandler} */
export function GET() {
    try {
        const radioStatePath = path.join(__dirname, '..', '..', '..', 'static', 'radio_state.json');
        const radioState = JSON.parse(fs.readFileSync(radioStatePath, 'utf8'));
        return json(radioState);
    } catch (error) {
        console.error('Error reading radio state:', error);
        return json({ error: 'Unable to retrieve radio state' }, { status: 500 });
    }
}