#!/usr/bin/env node
import prompts from "prompts"
import * as chalk from 'chalk';// 改变屏幕文字颜色
import * as fs from "fs"
import * as path from "path";

const argv = process.argv.slice(2)
const cwd = process.cwd()
const renameFiles = {
    _gitignore: '.gitignore'
}

async function main() {
    const defaultTargetDir = argv[0] || 'create-components-project'
    let targetDir = '.';
    const getProjectName = () =>
        targetDir === '.' ? path.basename(path.resolve()) : targetDir
    let result: { overwrite?: string, packageName?: string } = {};
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
                    type: (_, {overwrite} = {overwrite: undefined}) => {
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
                        isValidPackageName(dir) || 'Invalid package.json name'
                },
            ]
        )
    } catch (cancelled) {
        console.log(cancelled.message)
        return
    }
    const {overwrite, packageName} = result;
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

    const pkg = JSON.parse(
        fs.readFileSync(path.join(templateDir, `package.json`), 'utf-8')
    )

    pkg.name = packageName || getProjectName()

    write('package.json', JSON.stringify(pkg, null, 2))
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
    return projectName
        .trim()
        .toLowerCase()
        .replace(/\s+/g, '-')
        .replace(/^[._]/, '')
        .replace(/[^a-z0-9-~]+/g, '-')
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
