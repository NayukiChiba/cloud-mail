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

app.get('/payment/notify', async c => {
	const success = await paymentService.handleNotify(c, c.req.query());
	return c.text(success ? 'success' : 'fail');
});

app.get('/payment/return', async c => {
	let verified = false;
	try {
		verified = await paymentService.verifyReturn(c, c.req.query());
	} catch (error) {
		console.error('易支付同步返回处理失败', error);
	}

	const redirectUrl = new URL('/upgrade', c.req.url);
	redirectUrl.searchParams.set('order', c.req.query('out_trade_no') || '');
	redirectUrl.searchParams.set('verified', verified ? '1' : '0');
	return c.redirect(redirectUrl.toString());
});
