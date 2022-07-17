import {readFile, writeFile} from 'node:fs/promises';
import {existsSync} from 'node:fs';

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
