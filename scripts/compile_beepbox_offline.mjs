import { doBuildBoth, system, cp } from "./build_utils.mjs";

system("npm run deploy-files", { stdio: "inherit" });
doBuildBoth("editor/main.ts", "to_deploy/beepbox_editor.js");
doBuildBoth("player/main.ts", "to_deploy/player/beepbox_player.js");

const filesToCopy = [
    "website/offline/icon.png",
    "website/offline/main.js",
    "website/offline/preload.js",
    "website/offline/3JnySDDxiSz36j6yGQ.woff2",
    "website/offline/jquery-3.4.1.min.js",
    "website/offline/select2.min.css",
    "website/offline/select2.min.js",
    "website/offline/index.html",
    "package.json",
];

for (const file of filesToCopy) cp(file, "to_deploy/" + file.split("/").at(-1));
