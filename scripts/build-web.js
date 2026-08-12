import { chmod, cp, mkdir, readFile, readdir, rename, rm, writeFile } from 'node:fs/promises'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import os from 'node:os'
import path from 'node:path'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const webDir = path.join(root, 'web')
const distDir = path.join(root, 'dist')

await rm(distDir, { recursive: true, force: true })
await mkdir(distDir, { recursive: true })
await cp(webDir, distDir, { recursive: true })

const deploymentHost =
  process.env.GITTYPER_DOWNLOAD_HOST ||
  process.env.VERCEL_PROJECT_PRODUCTION_URL ||
  process.env.VERCEL_URL ||
  'gittyper.vercel.app'
const baseUrl = deploymentHost.startsWith('http')
  ? deploymentHost.replace(/\/$/, '')
  : `https://${deploymentHost.replace(/\/$/, '')}`

const installerTemplate = await readFile(path.join(root, 'scripts', 'install.sh'), 'utf8')
const installer = installerTemplate.replaceAll('__GITTYPER_BASE_URL__', baseUrl)
const installerPath = path.join(distDir, 'install.sh')
await writeFile(installerPath, installer)
await chmod(installerPath, 0o755)

const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm'
const packed = spawnSync(npmCommand, ['pack', '--pack-destination', distDir], {
  cwd: root,
  encoding: 'utf8',
  env: {
    ...process.env,
    npm_config_cache: path.join(os.tmpdir(), 'gittyper-npm-cache'),
  },
})

if (packed.status !== 0) {
  process.stderr.write(packed.stderr || packed.stdout)
  process.exit(packed.status || 1)
}

const tarball = (await readdir(distDir)).find((file) => file.endsWith('.tgz'))
if (!tarball) throw new Error('npm pack did not create a tarball')
await rename(path.join(distDir, tarball), path.join(distDir, 'gittyper.tgz'))

process.stdout.write(`Built GitTyper web app in ${distDir}\n`)
