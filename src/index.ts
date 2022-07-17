/* eslint-disable no-console */
import {execSync} from 'node:child_process';
import {readdir} from 'node:fs/promises';
import {existsSync} from 'node:fs';
import {join} from 'node:path';
import semver from 'semver';
import {readPackage, writePackage} from './package';
import {parser, toArray} from './parser';

const PACKAGE_NAME = 'package.json';

const HELP = `
git-bump

git bump [options] [release]

# use server, default is patch
git bump [major, premajor, minor, preminor, patch, prepatch, prerelease]

# custom version
git bump v1.2.3

Options

--help			print this usage information
--dry			run dry mode
--commit		commit all changeds default is true
--message=		commit message, default is chore(release): v__VERSION__
--tag			create a new tag, default is true
--packages=		workspace packages, default is packages

`;

function isClean() {
	const r = execSync('git status -s', {encoding: 'utf8'});
	return r.length === 0;
}

function isWorkspace(cwd: string): boolean {
	return existsSync(join(cwd, 'pnpm-workspace.yaml'));
}

export default async function main(args: string[]) {
	const argv = parser(args);

	if (!isClean() && !argv.dry && !argv.help) {
		throw new Error(`git workspace is not clean, commit the changes or make stash`);
	}

	const [release = 'patch'] = argv._;
	const {
		help = false,
		commit = true,
		message = 'chore(release): v__VERSION__',
		tag = true,
		dry: runDry = false,
		packages: packagesContainer = 'packages',
	} = argv;

	if (help) {
		console.log(HELP);
		return;
	}

	const cwd = argv.cwd || process.cwd();

	const packagePath = join(cwd, PACKAGE_NAME);
	const rootPkg = await readPackage(packagePath);

	const version = rootPkg.version;

	const nextVersion =
		semver.valid(release) && semver.lt(version, release)
			? release
			: semver.inc(version, release as semver.ReleaseType);

	if (!nextVersion) {
		throw new Error(`invalid release version ${release}`);
	}

	if (isWorkspace(cwd)) {
		const packagesDirs = toArray(packagesContainer || 'packages');

		// update packages
		for (const packagesDir of packagesDirs) {
			const packagesPath = join(cwd, packagesDir);
			const packages = await readdir(packagesPath, {});

			for (const pkgDir of packages) {
				const pkgPath = join(packagesPath, pkgDir, PACKAGE_NAME);

				if (!existsSync(pkgPath)) {
					continue;
				}

				try {
					const pkg = await readPackage(pkgPath);

					if (!runDry) {
						pkg.version = nextVersion;
						await writePackage(packagesPath, pkg);
					}
					console.log(
						`Bump package ${pkg.name ?? pkgDir} from ${
							pkg.version || version
						} to ${nextVersion}`
					);
				} catch {
					console.log(`something went wrong, skip ${pkgDir}`);
				}
			}
		}
	}

	if (!runDry) {
		rootPkg.version = nextVersion;
		await writePackage(packagePath, rootPkg);
	}
	console.log(`Bump ${rootPkg.name ?? 'project'} from ${version} to ${nextVersion}`);

	if (commit && !runDry) {
		execSync('git add .', {stdio: 'inherit'});
		execSync(`git commit -m "${message.replace('__VERSION__', nextVersion)}"`, {
			stdio: 'inherit',
		});
	}
	console.log(
		`Commit message ${message.replace('__VERSION__', nextVersion)}, ${
			runDry ? 'skip' : 'done'
		}`
	);

	if (tag && !runDry) {
		execSync(`git tag -a v${nextVersion} -m "v${nextVersion}"`, {stdio: 'inherit'});
	}
	console.log(`Tag v${nextVersion}, ${runDry ? 'skip' : 'done'}`);

	console.log(`You should push to origin by youself`);
}
