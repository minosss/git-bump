import {execSync} from 'node:child_process';
import {existsSync} from 'node:fs';
import {join, resolve} from 'node:path';
import parser from '@yme/argv';
import {readPackage, readPackages} from './package';
import {bump} from './bump';
import type {BumpInfo} from './bump';

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

# single package
git bump [options] [semver]

# bump packages with same version
# packages in the packages/ directory
git bump [options] [semver]

# independent version
# must in a workspace
git bump [options] [semver] --filter=@org/{like,this}

Options

--help			print this usage information
--dry			run dry mode
--commit		commit all changeds default is true
--message=		commit message, default is chore(release): v__VERSION__
--tag			create a new tag, default is true
--packages=		workspace packages, default is packages
--filter=		filter packages by package's name
				note: use filter in a workspace will enable independent mode

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
		packages: packagesDirs = 'packages',
		filter,
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

	// many packages
	const monorepo = isWorkspace(cwd);
	// package has independent version
	const filters = toArray(filter).filter(Boolean);
	const independent = monorepo && filters.length > 0;
	//
	const bumpInfos: BumpInfo[] = [];
	const dirs = toArray(packagesDirs).filter(Boolean);

	if (monorepo) {
		const canBump = (pkg: {name?: string; private?: boolean}) =>
			!independent || filters.includes(pkg.name);

		// update packages
		for (const dir of dirs) {
			// !resolve cwd path
			const packagesPath = resolve(cwd, dir);
			// read packages
			const packages = await readPackages(packagesPath);

			for (const pkgDir of packages) {
				const pkgPath = join(packagesPath, pkgDir, PACKAGE_NAME);

				// skip, if the package.json doesn't exist
				if (!existsSync(pkgPath)) continue;

				const pkg = await readPackage(pkgPath);

				// filter
				if (!canBump(pkg)) continue;

				try {
					const bumpInfo = await bump(pkgPath, release, {dry: runDry});

					// for commit messages
					bumpInfos.push(bumpInfo);

					log(
						`Bump package ${bumpInfo.name} from ${bumpInfo.preVersion} to ${bumpInfo.version}`,
						runDry
					);
				} catch {
					console.log(`something went wrong, skip ${pkg.name ?? pkgPath}`);
				}
			}

			console.log();
		}
	}

	let rootBumpInfo: BumpInfo = {
		name: 'project',
		preVersion: '',
		version: 'ersion',
	};

	if (!independent) {
		const rootPath = join(cwd, PACKAGE_NAME);
		rootBumpInfo = await bump(rootPath, release, {dry: runDry});

		log(
			`Bump ${rootBumpInfo.name ?? 'project'} from ${rootBumpInfo.preVersion} to ${
				rootBumpInfo.version
			}`,
			runDry
		);
		console.log();
	}

	if (commit) {
		const description = bumpInfos.map((info) => `${info.name} v${info.version}`).join('\n');
		const commitCommand = independent
			? `git commit -m "chore(release): bump ${dirs.join(',')}" -m $"${description}"`
			: `git commit -m "${message.replace('__VERSION__', rootBumpInfo.version)}"`;

		if (!runDry) {
			execSync('git add .', {stdio: 'inherit'});
			execSync(commitCommand, {
				stdio: 'inherit',
			});
		}

		log(commitCommand, runDry);
	}

	if (tag) {
		if (independent) {
			for (const info of bumpInfos) {
				gitTag(`${info.name}@v${info.version}`, `${info.name}@v${info.version}`, runDry);
			}
		} else {
			gitTag(`v${rootBumpInfo.version}`, `v${rootBumpInfo.version}`, runDry);
		}
	}

	console.log();
	console.log(`Done, You should push to origin by youself`);
}

function gitTag(tag: string, message: string, dry = false) {
	const tagCommand = `git tag -a ${tag} -m "${message}"`;
	if (!dry) {
		execSync(tagCommand, {stdio: 'inherit'});
	}
	log(tagCommand, dry);
}

function log(message: string, dry = false) {
	console.log(`${message}${dry ? ', skip' : ''}`);
}
