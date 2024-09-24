#!/usr/bin/env node
import prompts from "prompts"
import * as fs from "fs"
import * as path from "path";
import * as chalk from "chalk"
import {
    copy,
    emptyDir,
    formatTargetDir,
    isEmpty,
    isValidPackageName,
    pkgFromUserAgent,
    resolvePackageJson,
    run,
    toValidComponentName,
    toValidPackageName,
    writeTpl
} from "./utils";

const argv = process.argv.slice(2)
const cwd = process.cwd()
const renameFiles = {
    _gitignore: '.gitignore'
}
type Result = { overwrite?: string, packageName?: string, gitInit?: boolean, contributors?: string }

async function main() {
    const defaultTargetDir = argv[0] || 'create-components-project'
    let targetDir = '.';
    const getProjectName = () =>
        targetDir === '.' ? path.basename(path.resolve()) : targetDir
    let result: Result = {};
    try {
        result = await prompts(
            [
                {
                    type: 'text',
                    name: 'projectName',
                    message: chalk.reset('Project name:'),
                    initial: defaultTargetDir,
                    onState: (state) => {
                        targetDir = formatTargetDir(state.value) || defaultTargetDir
                    }
                },
                {
                    type: () =>
                        !fs.existsSync(targetDir) || isEmpty(targetDir) ? null : 'confirm',
                    name: 'overwrite',
                    message: () =>
                        (targetDir === '.'
                            ? 'Current directory'
                            : `Target directory "${targetDir}"`) +
                        ` is not empty. Remove existing files and continue?`
                },
                {
                    type: (_, {overwrite} = {overwrite: undefined} as any) => {
                        if (overwrite === false) {
                            throw new Error(chalk.red('✖') + ' Operation cancelled')
                        }
                        return null
                    },
                    name: 'overwriteChecker'
                },
                {
                    type: () => (isValidPackageName(getProjectName()) ? null : 'text'),
                    name: 'packageName',
                    message: chalk.reset('Package name:'),
                    initial: () => toValidPackageName(getProjectName()),
                    validate: (dir) =>
                        isValidPackageName(dir) || 'Invalid package.json name',
                    onState: (state) => {
                        targetDir = formatTargetDir(state.value) || defaultTargetDir
                    }
                },
                {
                    type: 'confirm',
                    name: 'gitInit',
                    message: chalk.reset('init git ?'),
                    initial: true
                },
                {
                    type: 'text',
                    name: 'contributors',
                    message: chalk.reset(`contributors: ?`),
                    initial: "xx"
                },
            ]
        )
    } catch (cancelled) {
        console.log(cancelled.message)
        return
    }
    const {overwrite, packageName, gitInit, contributors} = result;
    const root = path.join(cwd, targetDir);

    if (overwrite) {
        emptyDir(root)
    } else if (!fs.existsSync(root)) {
        fs.mkdirSync(root, {recursive: true})
    }
    const templateDir = path.resolve(__dirname, `../template`)

    const write = (file: string, content?: string) => {
        const targetPath = renameFiles[file]
            ? path.join(root, renameFiles[file])
            : path.join(root, file)
        if (content) {
            fs.writeFileSync(targetPath, content)
        } else {
            copy(path.join(templateDir, file), targetPath)
        }
    }

    const files = fs.readdirSync(templateDir)
    for (const file of files.filter((f) => f !== 'package.json')) {
        write(file)
    }
    //.gitignore 文件默认不发布到npm 所以模板文件改了个名称
    fs.renameSync(path.join(root, '.gitignore-tpl'), path.join(root, '.gitignore'));
    copy(path.join(templateDir, '.gitignore-tpl'), path.join(root, '.gitignore'))
    const pkg = resolvePackageJson(templateDir)

    const projectName = getProjectName()
    const validProjectName = toValidPackageName(projectName)

    pkg.name = validProjectName
    pkg.keywords = [projectName]
    pkg.description = projectName;
    pkg.homepage = `https://github.com/${contributors}/${validProjectName}.git`;
    pkg.repository = {
        type: "git",
        url: `https://github.com/${contributors}/${validProjectName}.git`
    };
    pkg.bugs = {
        url: `https://github.com/${contributors}/${validProjectName}/issues`
    };
    pkg.author = contributors
    pkg.license = "ISC"
    write('package.json', JSON.stringify(pkg, null, 2))

    const validName = toValidComponentName(projectName)

    const fields = {
        isHook: validName.startsWith("use"),
        hookName: validName,
        componentName: validName,
        hookNameFirstUpperCase: validName.charAt(0).toUpperCase() + validName.slice(1),
        publishDir: `./npm`
    }
    writeTpl(path.join(root, `/espkg.config.ts`), fields);
    writeTpl(path.join(root, `/src/index.tsx`), fields);
    writeTpl(path.join(root, `/examples/App.tsx`), fields);
    replaceReadMe(root,validProjectName)

    if (gitInit) {
        await run(`git`, ["init"], {
            cwd: root,
        })
    }
    const pkgInfo = pkgFromUserAgent(process.env.npm_config_user_agent)
    const pkgManager = pkgInfo ? pkgInfo.name : 'npm'

    console.log(`\nDone. ${chalk.green('Now run:')}\n`)
    if (root !== cwd) {
        console.log(chalk.blue(`  cd ${path.relative(cwd, root)}`))
    }
    switch (pkgManager) {
        case 'yarn':
            console.log(chalk.blue('  yarn'))
            console.log(chalk.blue('  yarn dev'))
            break
        default:
            console.log(chalk.blue(`  ${pkgManager} install`))
            console.log(chalk.blue(`  ${pkgManager} run dev`))
            break
    }
    console.log()
}

function replaceReadMe(root: string, validProjectName: string) {
    const md = fs.readFileSync(path.join(root, `/README.md`), 'utf-8')
    fs.writeFileSync(path.join(root, `/README.md`), md.replace('vite-com', validProjectName), 'utf-8')
}

main().catch(err => {
    console.error(err);
    process.exit()
})
// Listen for key events on stdin
process.stdin.on('keypress', (key, data) => {
    if (data && data.ctrl && data.name === 'c') {
        console.log('\nCtrl+C pressed. Exiting...');
        process.exit();
    }
});
process.stdin.setRawMode(true);
process.stdin.resume();
