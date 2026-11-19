// Writes the server entry of the @kismet/sdk package from the source Kismet serves at /sdk/.
import { writeFileSync } from "node:fs";
import { SERVER_SDK_SOURCE, SERVER_SDK_TYPES } from "../src/lib/sdk/kismet-server.ts";

const dir = new URL("../packages/sdk/", import.meta.url);
writeFileSync(new URL("index.mjs", dir), SERVER_SDK_SOURCE);
writeFileSync(new URL("index.d.mts", dir), SERVER_SDK_TYPES);
console.log("Wrote packages/sdk/index.mjs and index.d.mts");
