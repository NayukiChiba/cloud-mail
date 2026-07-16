import { and, eq } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import BizError from '../error/biz-error';
import orm from '../entity/orm';
import paymentOrder from '../entity/payment-order';
import roleService from './role-service';
import userService from './user-service';
import {
	buildEpayRequest,
	formatMoney,
	parseMoneyToCents,
	verifyEpayResponse
} from '../utils/epay-utils';
import { t } from '../i18n/i18n';

const PAYMENT_STATUS = {
	PENDING: 0,
	PAID: 1
};

const PAYMENT_TYPES = ['alipay', 'wxpay'];

// 套餐价格是累计价格，升级时只收目标套餐与当前套餐的差价。
const PAYMENT_PLANS = [
	{ code: 'multi-game', name: '多域用户', roleId: 2, level: 1, priceCent: 500 },
	{ code: 'multi-account', name: '多账户用户', roleId: 4, level: 2, priceCent: 1000 },
	{ code: 'premium', name: '高级用户', roleId: 5, level: 3, priceCent: 1500 }
];

function getPlanByCode(planCode) {
	return PAYMENT_PLANS.find(plan => plan.code === planCode);
}

function getPlanByRoleId(roleId) {
	return PAYMENT_PLANS.find(plan => plan.roleId === roleId);
}

function getEpayConfig(c) {
	const apiUrl = String(c.env.epay_api_url || '').trim();
	const pid = String(c.env.epay_pid || '').trim();
	// 未配置固定站点时，使用用户当前访问的域名生成支付回调地址。
	const requestOrigin = new URL(c.req.url).origin;
	const siteUrl = String(c.env.epay_site_url || requestOrigin).replace(/\/$/, '');
	const merchantKey = String(c.env.EPAY_KEY || '').trim();

	if (!apiUrl || !pid || !merchantKey) {
		throw new BizError(t('paymentNotConfigured'));
	}

	return {
		apiUrl: apiUrl.endsWith('/') ? apiUrl : `${apiUrl}/`,
		pid,
		siteUrl,
		merchantKey
	};
}

function createOrderId() {
	return `CM${Date.now()}${uuidv4().replaceAll('-', '').slice(0, 10)}`;
}

function formatPlan(plan, currentPlan) {
	const currentLevel = currentPlan?.level || 0;
	const currentPriceCent = currentPlan?.priceCent || 0;
	const canUpgrade = plan.level > currentLevel;
	const payAmountCent = canUpgrade ? plan.priceCent - currentPriceCent : 0;

	return {
		...plan,
		price: formatMoney(plan.priceCent),
		payAmountCent,
		payAmount: formatMoney(payAmountCent),
		canUpgrade
	};
}

const paymentService = {
	async plans(c, userId) {
		const userRow = await userService.selectById(c, userId);
		if (!userRow) {
			throw new BizError(t('authExpired'), 401);
		}

		const currentRole = await roleService.selectById(c, userRow.type);
		const currentPlan = getPlanByRoleId(userRow.type);

		return {
			currentRoleId: userRow.type,
			currentRoleName: currentRole?.name || '',
			currentLevel: currentPlan?.level || 0,
			currentPrice: formatMoney(currentPlan?.priceCent || 0),
			plans: PAYMENT_PLANS.map(plan => formatPlan(plan, currentPlan))
		};
	},

	async createOrder(c, params, userId) {
		const { planCode, paymentType } = params;
		const plan = getPlanByCode(planCode);
		if (!plan) {
			throw new BizError(t('paymentPlanNotExist'));
		}
		if (!PAYMENT_TYPES.includes(paymentType)) {
			throw new BizError(t('paymentTypeInvalid'));
		}

		const [userRow, targetRole] = await Promise.all([
			userService.selectById(c, userId),
			roleService.selectById(c, plan.roleId)
		]);
		if (!userRow) {
			throw new BizError(t('authExpired'), 401);
		}
		if (userRow.email === c.env.admin) {
			throw new BizError(t('paymentAdminNotRequired'));
		}
		if (!targetRole) {
			throw new BizError(t('roleNotExist'));
		}

		const currentPlan = getPlanByRoleId(userRow.type);
		const currentLevel = currentPlan?.level || 0;
		if (plan.level <= currentLevel) {
			throw new BizError(t('paymentCannotUpgrade'));
		}

		const amountCent = plan.priceCent - (currentPlan?.priceCent || 0);
		const orderId = createOrderId();
		const config = getEpayConfig(c);

		await orm(c).insert(paymentOrder).values({
			orderId,
			userId,
			fromRoleId: userRow.type,
			targetRoleId: plan.roleId,
			planCode: plan.code,
			productName: plan.name,
			amountCent,
			paymentType
		}).run();

		const fields = await buildEpayRequest({
			type: paymentType,
			notify_url: `${config.siteUrl}/api/payment/notify`,
			return_url: `${config.siteUrl}/api/payment/return`,
			out_trade_no: orderId,
			name: `Cloud Mail ${plan.name}永久权限`,
			money: formatMoney(amountCent),
			sitename: 'Cloud Mail'
		}, config.pid, config.merchantKey);

		return {
			orderId,
			submitUrl: new URL('xpay/epay/submit.php', config.apiUrl).toString(),
			fields
		};
	},

	async selectUserOrder(c, orderId, userId) {
		const order = await orm(c).select().from(paymentOrder).where(
			and(eq(paymentOrder.orderId, orderId), eq(paymentOrder.userId, userId))
		).get();
		if (!order) {
			throw new BizError(t('paymentOrderNotExist'));
		}

		return {
			...order,
			amount: formatMoney(order.amountCent)
		};
	},

	async handleNotify(c, params) {
		let config;
		try {
			config = getEpayConfig(c);
		} catch (error) {
			console.error(error);
			return false;
		}

		if (!verifyEpayResponse(params, config.merchantKey)) {
			return false;
		}
		if (String(params.pid) !== config.pid || params.trade_status !== 'TRADE_SUCCESS') {
			return false;
		}

		const order = await orm(c).select().from(paymentOrder)
			.where(eq(paymentOrder.orderId, params.out_trade_no)).get();
		if (!order || parseMoneyToCents(params.money) !== order.amountCent) {
			return false;
		}
		if (order.status === PAYMENT_STATUS.PAID) {
			return true;
		}

		const targetPlan = getPlanByRoleId(order.targetRoleId);
		if (!targetPlan) {
			return false;
		}

		const lowerRoleIds = [...new Set([
			1,
			order.fromRoleId,
			...PAYMENT_PLANS
				.filter(plan => plan.level < targetPlan.level)
				.map(plan => plan.roleId)
		])];
		const placeholders = lowerRoleIds.map(() => '?').join(',');
		const paidTime = new Date().toISOString();

		// D1 batch 保证订单入账和权限提升一起成功；重复通知只会重复设置相同角色。
		await c.env.db.batch([
			c.env.db.prepare(`
				UPDATE payment_order
				SET status = ?, platform_trade_no = ?, paid_time = ?
				WHERE order_id = ? AND status = ?
			`).bind(
				PAYMENT_STATUS.PAID,
				String(params.trade_no || ''),
				paidTime,
				order.orderId,
				PAYMENT_STATUS.PENDING
			),
			c.env.db.prepare(`
				UPDATE user SET type = ?
				WHERE user_id = ? AND type IN (${placeholders}) AND email != ?
			`).bind(order.targetRoleId, order.userId, ...lowerRoleIds, c.env.admin)
		]);

		return true;
	},

	verifyReturn(c, params) {
		const config = getEpayConfig(c);
		return verifyEpayResponse(params, config.merchantKey);
	}
};

export default paymentService;
