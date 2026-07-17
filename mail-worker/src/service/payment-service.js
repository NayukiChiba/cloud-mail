import BizError from '../error/biz-error';
import roleService from './role-service';
import userService from './user-service';
import { formatMoney } from '../utils/payment-utils';
import { t } from '../i18n/i18n';

// 套餐价格是累计价格，仅用于在升级页面显示等级和差价。
const PAYMENT_PLANS = [
	{ code: 'multi-domain', name: '多域用户', roleId: 2, level: 1, priceCent: 500 },
	{ code: 'multi-account', name: '多账户用户', roleId: 3, level: 2, priceCent: 1000 },
	{ code: 'premium', name: '高级用户', roleId: 4, level: 3, priceCent: 1500 }
];

function getPlanByRoleId(roleId) {
	return PAYMENT_PLANS.find(plan => plan.roleId === roleId);
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
	}
};

export default paymentService;
