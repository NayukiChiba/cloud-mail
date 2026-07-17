import app from '../hono/hono';
import result from '../model/result';
import paymentService from '../service/payment-service';
import userContext from '../security/user-context';

app.get('/payment/plans', async c => {
	const data = await paymentService.plans(c, userContext.getUserId(c));
	return c.json(result.ok(data));
});
