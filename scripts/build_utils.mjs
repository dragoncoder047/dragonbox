import { build, context } from "esbuild";
export { cp } from "node:fs/promises";
export { execSync as system } from "child_process";
export async function doBuildBoth(main, outfile, watch = false) {

    /**
     * @type {import("esbuild").BuildOptions}
     */
    const opts = {
        entryPoints: [main],
        bundle: true,
        minify: false,
        sourcemap: true,
        format: "iife",
        globalName: "beepbox",
        outfile,
        define: {
            OFFLINE: "false"
        },
        target: "esnext",
        mangleProps: /^_.+/
    };

    if (watch) {
        await context(opts).then(ctx => ctx.watch());
    } else {
        await build(opts);
        await build({
            ...opts,
            minify: true,
            outfile: outfile.replace(/\.js$/, ".min.js")
        });
    }

}
