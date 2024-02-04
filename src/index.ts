#!/usr/bin/env node
import prompts from "prompts"
import * as fs from "fs"
import * as path from "path";
import * as execa from "execa"
import * as chalk from "chalk"

import type {Options as ExecaOptions, ExecaReturnValue} from 'execa'

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
    const pkg = JSON.parse(
        fs.readFileSync(path.join(templateDir, `package.json`), 'utf-8')
    )

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

    /*const esPkg = JSON.parse(
        fs.readFileSync(path.join(templateDir, `espkg.json`), 'utf-8')
    )
    esPkg.publishDir = `${validProjectName}-npm`
    write('espkg.json', JSON.stringify(esPkg, null, 2))*/

    const validName = toValidComponentName(projectName)

    const fields = {
        isHook: validName.startsWith("use"),
        hookName: validName,
        componentName: validName,
        hookNameFirstUpperCase: validName.charAt(0).toUpperCase() + validName.slice(1),
        publishDir: `../${validProjectName}-npm`
    }
    writeTpl(path.join(root, `/espkg.config.ts`), fields);
    writeTpl(path.join(root, `/src/index.tsx`), fields);
    writeTpl(path.join(root, `/examples/App.tsx`), fields);

    if (gitInit) {
        await run(`git`, ["init"])
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

function writeTpl(targetPath: string, fields: object) {
    let result = "";
    (() => {
        const content = fs.readFileSync(targetPath, 'utf-8')
        const run = `(()=>{
                with (fields) {
                    result = eval(content);
                }
            })()`;
        eval(run);
    })()
    fs.writeFileSync(targetPath, result, 'utf-8')
}

export async function run(
    bin: string,
    args: string[],
    opts: ExecaOptions<string> = {}
): Promise<ExecaReturnValue<string>> {
    if ("default" in execa && typeof execa.default === "function") {
        return execa.default(bin, args, {stdio: 'inherit', ...opts})
    }
}

function toValidComponentName(name: string) {
    const _name = name.replace(/_(\w)/g, (all, letter) => letter.toUpperCase());
    const res = _name.replace(/-(\w)/g, (all, letter) => letter.toUpperCase());
    if (res.startsWith('use')) {
        return res;
    }
    const [first, ...rest] = res.split('');
    return [first.toUpperCase(), ...rest].join('');
}

function formatTargetDir(targetDir: string) {
    return targetDir?.trim().replace(/\/+$/g, '')
}

function isEmpty(path: string) {
    const files = fs.readdirSync(path)
    return files.length === 0 || (files.length === 1 && files[0] === '.git')
}

/**
 * @param {string} projectName
 */
function isValidPackageName(projectName: string) {
    return /^(?:@[a-z0-9-*~][a-z0-9-*._~]*\/)?[a-z0-9-~][a-z0-9-._~]*$/.test(
        projectName
    )
}

/**
 * @param {string} projectName
 */
function toValidPackageName(projectName: string) {
    return getKebabCase(projectName
        .trim())
        .toLowerCase()
        .replace(/\s+/g, '-')
        .replace(/^[._]/, '')
        .replace(/[^a-z0-9-~]+/g, '-')
}

function getKebabCase(str: string) {
    str = str.replace(/^-+|-+$/g, '');
    let temp = str.replace(/[A-Z]/g, function (i, index) {
        if (str[index - 1] === "-") {
            return i.toLowerCase();
        }
        return '-' + i.toLowerCase();
    })
    if (temp.slice(0, 1) === '-') {
        temp = temp.slice(1);   //如果首字母是大写，执行replace时会多一个_，需要去掉
    }
    return temp;
}

/**
 * @param {string} dir
 */
function emptyDir(dir) {
    if (!fs.existsSync(dir)) {
        return
    }
    for (const file of fs.readdirSync(dir)) {
        fs.rmSync(path.resolve(dir, file), {recursive: true, force: true})
    }
}

/**
 * @param {string} srcDir
 * @param {string} destDir
 */
function copyDir(srcDir: string, destDir: string) {
    fs.mkdirSync(destDir, {recursive: true})
    for (const file of fs.readdirSync(srcDir)) {
        const srcFile = path.resolve(srcDir, file)
        const destFile = path.resolve(destDir, file)
        copy(srcFile, destFile)
    }
}

function copy(src: string, dest: string) {
    const stat = fs.statSync(src)
    if (stat.isDirectory()) {
        copyDir(src, dest)
    } else {
        fs.copyFileSync(src, dest)
    }
}

function pkgFromUserAgent(userAgent: string) {
    if (!userAgent) return undefined
    const pkgSpec = userAgent.split(' ')[0]
    const pkgSpecArr = pkgSpec.split('/')
    return {
        name: pkgSpecArr[0],
        version: pkgSpecArr[1]
    }
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
