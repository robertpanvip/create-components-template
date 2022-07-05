import type {BuildOptions} from 'esbuild'
import {build} from 'esbuild'

async function main() {
    const buildOptions: BuildOptions = {
        absWorkingDir: process.cwd(),
        entryPoints: ['./src/index.ts'],
        bundle: false,
        platform: 'node',
        format: 'cjs',
        target: 'node8',
        splitting: false,
        sourcemap: false,
        outdir: 'bin',
        ignoreAnnotations: false,
    }
    await build(buildOptions)
}

main().catch(err => {
    console.error(err);
    process.exit()
})