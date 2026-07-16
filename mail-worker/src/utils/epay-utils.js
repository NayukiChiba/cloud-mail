const MD5_SHIFT = [
	7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22,
	5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20,
	4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23,
	6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21
];

const MD5_CONSTANT = Array.from(
	{ length: 64 },
	(_, index) => Math.floor(Math.abs(Math.sin(index + 1)) * 0x100000000) >>> 0
);

function rotateLeft(value, shift) {
	return ((value << shift) | (value >>> (32 - shift))) >>> 0;
}

function wordToHex(value) {
	return [0, 8, 16, 24]
		.map(shift => ((value >>> shift) & 0xff).toString(16).padStart(2, '0'))
		.join('');
}

// Workers Web Crypto 不支持 MD5，这里仅用于兼容易支付 V1 的签名协议。
export function md5(value) {
	const input = new TextEncoder().encode(String(value));
	const paddedLength = Math.ceil((input.length + 9) / 64) * 64;
	const padded = new Uint8Array(paddedLength);
	padded.set(input);
	padded[input.length] = 0x80;

	const bitLength = BigInt(input.length) * 8n;
	const view = new DataView(padded.buffer);
	view.setUint32(paddedLength - 8, Number(bitLength & 0xffffffffn), true);
	view.setUint32(paddedLength - 4, Number((bitLength >> 32n) & 0xffffffffn), true);

	let stateA = 0x67452301;
	let stateB = 0xefcdab89;
	let stateC = 0x98badcfe;
	let stateD = 0x10325476;

	for (let offset = 0; offset < paddedLength; offset += 64) {
		const words = Array.from(
			{ length: 16 },
			(_, index) => view.getUint32(offset + index * 4, true)
		);
		let a = stateA;
		let b = stateB;
		let c = stateC;
		let d = stateD;

		for (let index = 0; index < 64; index++) {
			let result;
			let wordIndex;

			if (index < 16) {
				result = (b & c) | (~b & d);
				wordIndex = index;
			} else if (index < 32) {
				result = (d & b) | (~d & c);
				wordIndex = (5 * index + 1) % 16;
			} else if (index < 48) {
				result = b ^ c ^ d;
				wordIndex = (3 * index + 5) % 16;
			} else {
				result = c ^ (b | ~d);
				wordIndex = (7 * index) % 16;
			}

			const previousD = d;
			d = c;
			c = b;
			b = (b + rotateLeft(
				(a + result + MD5_CONSTANT[index] + words[wordIndex]) >>> 0,
				MD5_SHIFT[index]
			)) >>> 0;
			a = previousD;
		}

		stateA = (stateA + a) >>> 0;
		stateB = (stateB + b) >>> 0;
		stateC = (stateC + c) >>> 0;
		stateD = (stateD + d) >>> 0;
	}

	return [stateA, stateB, stateC, stateD].map(wordToHex).join('');
}

function isEmpty(value) {
	return value === null || value === undefined || String(value).trim() === '';
}

export function getEpaySignContent(params) {
	return Object.keys(params)
		.sort()
		.filter(key => key !== 'sign' && key !== 'sign_type')
		.filter(key => !Array.isArray(params[key]) && !isEmpty(params[key]))
		.map(key => `${key}=${params[key]}`)
		.join('&');
}

export function buildEpayRequest(params, pid, merchantKey) {
	const requestParams = {
		...params,
		pid: String(pid)
	};

	return {
		...requestParams,
		sign: md5(`${getEpaySignContent(requestParams)}${merchantKey}`),
		sign_type: 'MD5'
	};
}

export function verifyEpayResponse(params, merchantKey) {
	if (!params?.sign || !merchantKey || String(params.sign_type || 'MD5').toUpperCase() !== 'MD5') {
		return false;
	}

	const expectedSign = md5(`${getEpaySignContent(params)}${merchantKey}`);
	const receivedSign = String(params.sign).toLowerCase();
	if (expectedSign.length !== receivedSign.length) {
		return false;
	}

	let difference = 0;
	for (let index = 0; index < expectedSign.length; index++) {
		difference |= expectedSign.charCodeAt(index) ^ receivedSign.charCodeAt(index);
	}
	return difference === 0;
}

export function parseMoneyToCents(money) {
	const value = String(money || '').trim();
	if (!/^\d+(\.\d{1,2})?$/.test(value)) {
		return null;
	}

	const [yuan, decimal = ''] = value.split('.');
	return Number(yuan) * 100 + Number(decimal.padEnd(2, '0'));
}

export function formatMoney(amountCent) {
	return (amountCent / 100).toFixed(2);
}
