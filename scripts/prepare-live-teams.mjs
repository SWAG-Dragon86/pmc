import { copyFileSync } from "node:fs";

copyFileSync(new URL("../src/data/open-teams.json", import.meta.url), new URL("../public/live-teams.json", import.meta.url));
