import * as fs from "fs"
import * as path from "path";
import * as execa from "execa"

import type {Options as ExecaOptions, ExecaReturnValue} from 'execa'

export async function run(
    bin: string,
    args: string[],
    opts: ExecaOptions<string> = {}
): Promise<ExecaReturnValue<string>> {
    if ("default" in execa && typeof execa.default === "function") {
        return execa.default(bin, args, {stdio: 'inherit', ...opts})
    }
}

export function toValidComponentName(name: string) {
    const _name = name.replace(/_(\w)/g, (all, letter) => letter.toUpperCase());
    const res = _name.replace(/-(\w)/g, (all, letter) => letter.toUpperCase());
    if (res.startsWith('use')) {
        return res;
    }
    const [first, ...rest] = res.split('');
    return [first.toUpperCase(), ...rest].join('');
}

export function formatTargetDir(targetDir: string) {
    return targetDir?.trim().replace(/\/+$/g, '')
}

export function isEmpty(path: string) {
    const files = fs.readdirSync(path)
    return files.length === 0 || (files.length === 1 && files[0] === '.git')
}

/**
 * @param {string} projectName
 */
export function isValidPackageName(projectName: string) {
    return /^(?:@[a-z0-9-*~][a-z0-9-*._~]*\/)?[a-z0-9-~][a-z0-9-._~]*$/.test(
        projectName
    )
}

/**
 * @param {string} projectName
 */
export function toValidPackageName(projectName: string) {
    return getKebabCase(projectName
        .trim())
        .toLowerCase()
        .replace(/\s+/g, '-')
        .replace(/^[._]/, '')
        .replace(/[^a-z0-9-~]+/g, '-')
}

export function getKebabCase(str: string) {
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
export function emptyDir(dir) {
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
export function copyDir(srcDir: string, destDir: string) {
    fs.mkdirSync(destDir, {recursive: true})
    for (const file of fs.readdirSync(srcDir)) {
        const srcFile = path.resolve(srcDir, file)
        const destFile = path.resolve(destDir, file)
        copy(srcFile, destFile)
    }
}

export function copy(src: string, dest: string) {
    const stat = fs.statSync(src)
    if (stat.isDirectory()) {
        copyDir(src, dest)
    } else {
        fs.copyFileSync(src, dest)
    }
}

export function pkgFromUserAgent(userAgent: string) {
    if (!userAgent) return undefined
    const pkgSpec = userAgent.split(' ')[0]
    const pkgSpecArr = pkgSpec.split('/')
    return {
        name: pkgSpecArr[0],
        version: pkgSpecArr[1]
    }
}

export function writeTpl(targetPath: string, fields: object) {
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

export function resolvePackageJson(dir: string) {
    let pkg;
    try {
        pkg = JSON.parse(
            fs.readFileSync(path.join(dir, `package.json`), 'utf-8')
        )
    } catch (e) {
        pkg = {}
    }
    return pkg
}