
import { doBuildBoth } from "./build_utils.mjs";

await doBuildBoth("editor/main.ts", "website/beepbox_editor.js", true);
