const RSA_ALGORITHM = {
	name: 'RSASSA-PKCS1-v1_5',
	hash: 'SHA-256'
};

function normalizeBase64Key(key) {
	return String(key || '')
		.replace(/-----BEGIN [^-]+-----/g, '')
		.replace(/-----END [^-]+-----/g, '')
		.replace(/\s/g, '');
}

function base64ToBytes(value) {
	const binary = atob(value);
	return Uint8Array.from(binary, char => char.charCodeAt(0));
}

function bytesToBase64(value) {
	return btoa(String.fromCharCode(...new Uint8Array(value)));
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

async function importPrivateKey(privateKey) {
	return crypto.subtle.importKey(
		'pkcs8',
		base64ToBytes(normalizeBase64Key(privateKey)),
		RSA_ALGORITHM,
		false,
		['sign']
	);
}

async function importPublicKey(publicKey) {
	return crypto.subtle.importKey(
		'spki',
		base64ToBytes(normalizeBase64Key(publicKey)),
		RSA_ALGORITHM,
		false,
		['verify']
	);
}

export async function buildEpayRequest(params, pid, privateKey) {
	const requestParams = {
		...params,
		pid: String(pid),
		timestamp: String(Math.floor(Date.now() / 1000))
	};
	const key = await importPrivateKey(privateKey);
	const content = new TextEncoder().encode(getEpaySignContent(requestParams));
	const signature = await crypto.subtle.sign(RSA_ALGORITHM, key, content);

	return {
		...requestParams,
		sign: bytesToBase64(signature),
		sign_type: 'RSA'
	};
}

export async function verifyEpayResponse(params, publicKey) {
	if (!params?.sign || !params?.timestamp || !publicKey) {
		return false;
	}

	const timestamp = Number(params.timestamp);
	const now = Math.floor(Date.now() / 1000);
	if (!Number.isFinite(timestamp) || Math.abs(now - timestamp) > 300) {
		return false;
	}

	try {
		const key = await importPublicKey(publicKey);
		const content = new TextEncoder().encode(getEpaySignContent(params));
		return crypto.subtle.verify(
			RSA_ALGORITHM,
			key,
			base64ToBytes(params.sign),
			content
		);
	} catch (error) {
		console.error('易支付验签失败', error);
		return false;
	}
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
