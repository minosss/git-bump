import {readdir, readFile, stat, writeFile} from 'node:fs/promises';
import {existsSync} from 'node:fs';
import {join} from 'node:path';

export async function readPackage(filePath: string) {
	if (!existsSync(filePath)) {
		throw new Error(`${filePath} does not exist`);
	}

	const raw = await readFile(filePath, {encoding: 'utf8'});
	return JSON.parse(raw);
}

export async function writePackage(filePath: string, data: any) {
	return await writeFile(filePath, JSON.stringify(data, null, '\t'), {encoding: 'utf8'});
}

export async function readPackages(dir: string): Promise<string[]> {
	try {
		const files = await readdir(dir, {});

		const packages: string[] = [];

		for (const file of files) {
			const path = join(dir, file);
			const info = await stat(path);
			if (info.isDirectory()) {
				packages.push(file);
			}
		}

		return packages;
	} catch (error: any) {
		console.log(`${error.message}, skip`);
	}

	return [];
}
