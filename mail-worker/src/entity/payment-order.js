import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

export const paymentOrder = sqliteTable('payment_order', {
	orderId: text('order_id').primaryKey(),
	userId: integer('user_id').notNull(),
	fromRoleId: integer('from_role_id').notNull(),
	targetRoleId: integer('target_role_id').notNull(),
	planCode: text('plan_code').notNull(),
	productName: text('product_name').notNull(),
	amountCent: integer('amount_cent').notNull(),
	paymentType: text('payment_type').notNull(),
	status: integer('status').notNull().default(0),
	platformTradeNo: text('platform_trade_no'),
	createTime: text('create_time').notNull().default(sql`CURRENT_TIMESTAMP`),
	paidTime: text('paid_time')
});

export default paymentOrder;
