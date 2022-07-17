/* eslint-disable no-console */
import {execSync} from 'node:child_process';
import {readdir, stat} from 'node:fs/promises';
import {existsSync} from 'node:fs';
import {join} from 'node:path';
import semver from 'semver';
import parser from '@yme/argv';
import {readPackage, writePackage} from './package';

const PACKAGE_NAME = 'package.json';

const HELP = `
git-bump

git bump [options] [release]

# help
git bump [help]

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

function toArray(value: any): any[] {
	return Array.isArray(value) ? value : [value];
}

export default async function main(args: string[]) {
	const argv = parser(args);

	const [release = 'help'] = argv._;
	const {
		commit = true,
		message = 'chore(release): v__VERSION__',
		tag = true,
		dry: runDry = false,
		packages: packagesContainer = 'packages',
		help,
	} = argv;

	if (help || release === 'help') {
		console.log(HELP);
		return;
	}

	if (!isClean() && !runDry) {
		throw new Error(
			`git workspace is not clean, commit the changes or make stash. run with --help see details`
		);
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
		console.log();

		const packagesDirs = toArray(packagesContainer || 'packages');

		// update packages
		for (const packagesDir of packagesDirs) {
			const packagesPath = join(cwd, packagesDir);

			console.log(`Scan ${packagesPath}`);

			const fileOrDirs = await readdir(packagesPath, {});

			// director only
			const packages: string[] = [];
			for (const fileOrDir of fileOrDirs) {
				const info = await stat(join(packagesPath, fileOrDir));

				if (info.isDirectory()) {
					packages.push(fileOrDir);
				}
			}

			if (packages.length > 0) {
				console.log(`Found workspace packages: ${packages.join(', ')}`);
			}

			for (const pkgDir of packages) {
				const pkgPath = join(packagesPath, pkgDir, PACKAGE_NAME);

				if (!existsSync(pkgPath)) {
					continue;
				}

				try {
					const pkg = await readPackage(pkgPath);
					const prevVersion = pkg.version;
					if (!runDry) {
						pkg.version = nextVersion;
						await writePackage(packagesPath, pkg);
					}

					console.log(
						`Bump package ${
							pkg.name ?? pkgDir
						} from ${prevVersion} to ${nextVersion}, ${runDry ? 'skip' : 'done'}`
					);
				} catch {
					console.log(`something went wrong, skip ${pkgDir}`);
				}
			}

			console.log();
		}
	}

	if (!runDry) {
		rootPkg.version = nextVersion;
		await writePackage(packagePath, rootPkg);
	}
	console.log(
		`Bump ${rootPkg.name ?? 'project'} from ${version} to ${nextVersion}, ${
			runDry ? 'skip' : 'done'
		}`
	);
	console.log();

	if (commit) {
		if (!runDry) {
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
	}

	if (tag) {
		if (!runDry) {
			execSync(`git tag -a v${nextVersion} -m "v${nextVersion}"`, {stdio: 'inherit'});
		}

		console.log(`Tag v${nextVersion}, ${runDry ? 'skip' : 'done'}`);
	}

	console.log();
	console.log(`Done, You should push to origin by youself`);
}
