import app from '../hono/hono';
import result from '../model/result';
import paymentService from '../service/payment-service';
import userContext from '../security/user-context';

app.get('/payment/plans', async c => {
	const data = await paymentService.plans(c, userContext.getUserId(c));
	return c.json(result.ok(data));
});

app.post('/payment/order', async c => {
	const data = await paymentService.createOrder(
		c,
		await c.req.json(),
		userContext.getUserId(c)
	);
	return c.json(result.ok(data));
});

app.get('/payment/order/:orderId', async c => {
	const data = await paymentService.selectUserOrder(
		c,
		c.req.param('orderId'),
		userContext.getUserId(c)
	);
	return c.json(result.ok(data));
});

async function getCallbackParams(c) {
	if (c.req.method === 'GET') {
		return c.req.query();
	}

	const body = await c.req.parseBody();
	return Object.fromEntries(
		Object.entries(body).map(([key, value]) => [key, String(value)])
	);
}

async function handleNotify(c) {
	const success = await paymentService.handleNotify(c, await getCallbackParams(c));
	return c.text(success ? 'success' : 'fail');
}

async function handleReturn(c) {
	const params = await getCallbackParams(c);
	let verified = false;
	try {
		verified = await paymentService.verifyReturn(c, params);
	} catch (error) {
		console.error('易支付同步返回处理失败', error);
	}

	const redirectUrl = new URL('/upgrade', c.req.url);
	redirectUrl.searchParams.set('order', params.out_trade_no || '');
	redirectUrl.searchParams.set('verified', verified ? '1' : '0');
	return c.redirect(redirectUrl.toString());
}

app.get('/payment/notify', handleNotify);
app.post('/payment/notify', handleNotify);
app.get('/payment/return', handleReturn);
app.post('/payment/return', handleReturn);
