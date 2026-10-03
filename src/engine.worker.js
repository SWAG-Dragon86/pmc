import {simulateTurn} from './engine.mjs';
import catalog from './data/catalog.json' with { type: 'json' };
self.onmessage=({data})=>self.postMessage(simulateTurn(data,catalog));
