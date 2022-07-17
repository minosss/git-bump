function isNumberLike(val: string): boolean {
	return /^[\d-]\d+(\.\d+)?$/.test(val);
}

export function toArray(value: any): any[] {
	return Array.isArray(value) ? value : [value];
}

const DEFINE_REGEX = /^--([\w-]+)=([\S\s]*)$/;
const BOOLEAN_REGEX = /^--(no-)?([\w-]+)$/;

export function parser(args: string[]) {
	const result: {_: string[]; __?: string[]; [key: string]: any} = {
		_: [],
	};

	if (args.includes('--')) {
		result['__'] = args.slice(args.indexOf('--') + 1);
		args = args.slice(0, args.indexOf('--'));
	}

	for (const arg of args) {
		if (DEFINE_REGEX.test(arg)) {
			const [_, key = '~.~', value = '~.~'] = DEFINE_REGEX.exec(arg) || [];

			if (isNumberLike(value)) {
				result[key] = Number.parseFloat(value);
			} else {
				// exists
				if (result[key]) {
					result[key] = [...toArray(result[key]), value];
				} else {
					result[key] = value;
				}
			}
		} else if (BOOLEAN_REGEX.test(arg)) {
			const [_, no, key = '~.~'] = BOOLEAN_REGEX.exec(arg) || [];

			result[key] = !no;
		} else {
			result._.push(arg);
		}
	}

	return result;
}
