import { build, context } from "esbuild";
import { cp as copyFile } from "node:fs/promises";
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
        await context({
            ...opts,
            plugins: [{
                name: "logger",
                setup(build) {
                    build.onEnd(result => {
                        if (result.errors.length == 0)
                            console.error(`rebuilt ${opts.outfile} OK`);
                        else
                            console.error(`failed to build ${opts.outfile}`);
                    });
                },
            }]
        }).then(ctx => ctx.watch());
    } else {
        await build(opts);
        await build({
            ...opts,
            minify: true,
            outfile: outfile.replace(/\.js$/, ".min.js")
        });
    }

}

export async function cp(from, to) {
    console.log("copying " + from + " to " + to);
    await copyFile(from, to);
}
