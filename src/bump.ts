import {existsSync} from 'fs';
import semver from 'semver';
import {readPackage, writePackage} from './package';

export interface Options {
	dry?: boolean;
}

export interface BumpInfo {
	name: string;
	preVersion: string;
	version: string;
}

export async function bump(packagePath: string, release: string, options: Options = {}) {
	if (!existsSync(packagePath)) {
		throw new Error(`${packagePath} does not exist`);
	}

	const {dry = false} = options;
	const pkg = await readPackage(packagePath);

	const version = pkg.version;

	const nextVersion =
		semver.valid(release) && semver.lt(version, release)
			? release
			: semver.inc(version, release as semver.ReleaseType);

	if (!nextVersion) {
		throw new Error(`invalid release version ${release}`);
	}

	if (!dry) {
		pkg.version = nextVersion;
		await writePackage(packagePath, pkg);
	}

	return {
		name: pkg.name,
		preVersion: version,
		version: nextVersion,
	} as BumpInfo;
}
