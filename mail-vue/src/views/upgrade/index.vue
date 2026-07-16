<template>
  <div class="upgrade-page">
    <div class="page-header">
      <div>
        <h2>{{ $t('upgradeRole') }}</h2>
        <p>{{ $t('upgradeRoleDesc') }}</p>
      </div>
      <el-tag v-if="planData.currentRoleName" type="primary" size="large">
        {{ $t('currentRole') }}：{{ planData.currentRoleName }}
      </el-tag>
    </div>

    <el-alert
        v-if="returnMessage"
        :title="returnMessage"
        :type="returnType"
        show-icon
        :closable="false"
        class="return-alert"
    />

    <el-skeleton :loading="loading" animated :rows="6">
      <div class="plan-list">
        <el-card
            v-for="plan in planData.plans"
            :key="plan.code"
            class="plan-card"
            :class="{ recommended: plan.code === 'premium' }"
            shadow="hover"
        >
          <div v-if="plan.code === 'premium'" class="recommended-label">
            {{ $t('recommended') }}
          </div>
          <h3>{{ plan.name }}</h3>
          <div class="price">
            <span>¥</span>{{ plan.price }}
          </div>
          <div class="permanent">{{ $t('permanentRole') }}</div>
          <el-divider />
          <div v-if="plan.canUpgrade" class="upgrade-price">
            {{ $t('upgradePayAmount') }}：<strong>¥{{ plan.payAmount }}</strong>
          </div>
          <div v-else class="upgrade-price disabled-text">
            {{ plan.roleId === planData.currentRoleId ? $t('currentPlan') : $t('cannotDowngrade') }}
          </div>
          <el-button
              type="primary"
              class="buy-button"
              :disabled="!plan.canUpgrade"
              @click="openPayment(plan)"
          >
            {{ $t('upgradeNow') }}
          </el-button>
        </el-card>
      </div>
    </el-skeleton>

    <el-dialog v-model="paymentVisible" :title="$t('selectPaymentMethod')" width="420px">
      <div v-if="selectedPlan" class="order-summary">
        <div><span>{{ $t('targetRole') }}</span><strong>{{ selectedPlan.name }}</strong></div>
        <div><span>{{ $t('paymentAmount') }}</span><strong>¥{{ selectedPlan.payAmount }}</strong></div>
      </div>
      <el-radio-group v-model="paymentType" class="payment-types">
        <el-radio-button value="alipay">{{ $t('alipay') }}</el-radio-button>
        <el-radio-button value="wxpay">{{ $t('wechatPay') }}</el-radio-button>
      </el-radio-group>
      <template #footer>
        <el-button @click="paymentVisible = false">{{ $t('cancel') }}</el-button>
        <el-button type="primary" :loading="creating" @click="createOrder">
          {{ $t('confirmPayment') }}
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { onBeforeUnmount, onMounted, reactive, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useI18n } from 'vue-i18n';
import { paymentCreateOrder, paymentOrder, paymentPlans } from '@/request/payment.js';
import { useUserStore } from '@/store/user.js';

const route = useRoute();
const router = useRouter();
const { t } = useI18n();
const userStore = useUserStore();

const loading = ref(true);
const creating = ref(false);
const paymentVisible = ref(false);
const paymentType = ref('alipay');
const selectedPlan = ref(null);
const returnMessage = ref('');
const returnType = ref('info');
const planData = reactive({
  currentRoleId: null,
  currentRoleName: '',
  plans: []
});

let pollTimer = null;
let pollCount = 0;

async function loadPlans() {
  loading.value = true;
  try {
    const data = await paymentPlans();
    Object.assign(planData, data);
  } finally {
    loading.value = false;
  }
}

function openPayment(plan) {
  selectedPlan.value = plan;
  paymentVisible.value = true;
}

function submitPaymentForm(submitUrl, fields) {
  const form = document.createElement('form');
  form.method = 'POST';
  form.action = submitUrl;
  form.style.display = 'none';

  Object.entries(fields).forEach(([name, value]) => {
    const input = document.createElement('input');
    input.type = 'hidden';
    input.name = name;
    input.value = value;
    form.appendChild(input);
  });

  document.body.appendChild(form);
  form.submit();
}

async function createOrder() {
  if (!selectedPlan.value) return;

  creating.value = true;
  try {
    const data = await paymentCreateOrder({
      planCode: selectedPlan.value.code,
      paymentType: paymentType.value
    });
    submitPaymentForm(data.submitUrl, data.fields);
  } finally {
    creating.value = false;
  }
}

async function checkOrder(orderId) {
  try {
    const order = await paymentOrder(orderId);
    if (order.status === 1) {
      clearInterval(pollTimer);
      returnMessage.value = t('paymentSuccess');
      returnType.value = 'success';
      userStore.refreshUserInfo();
      await loadPlans();
      return true;
    }

    pollCount += 1;
    if (pollCount >= 15) {
      clearInterval(pollTimer);
      returnMessage.value = t('paymentPending');
      returnType.value = 'warning';
      return true;
    }
  } catch (error) {
    clearInterval(pollTimer);
    return true;
  }

  return false;
}

onMounted(async () => {
  await loadPlans();

  const orderId = String(route.query.order || '');
  if (!orderId) return;

  if (route.query.verified === '0') {
    returnMessage.value = t('paymentReturnInvalid');
    returnType.value = 'warning';
  } else {
    returnMessage.value = t('paymentConfirming');
    returnType.value = 'info';
  }

  await router.replace({ name: 'upgrade' });
  const completed = await checkOrder(orderId);
  if (!completed) {
    pollTimer = setInterval(() => checkOrder(orderId), 2000);
  }
});

onBeforeUnmount(() => clearInterval(pollTimer));
</script>

<style lang="scss" scoped>
.upgrade-page {
  max-width: 1100px;
  margin: 0 auto;
  padding: 30px;
}

.page-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20px;
  margin-bottom: 24px;

  h2 {
    margin: 0 0 8px;
  }

  p {
    margin: 0;
    color: var(--el-text-color-secondary);
  }
}

.return-alert {
  margin-bottom: 20px;
}

.plan-list {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 20px;
}

.plan-card {
  position: relative;
  text-align: center;
  overflow: visible;

  h3 {
    margin: 8px 0 18px;
  }
}

.recommended {
  border-color: var(--el-color-primary);
}

.recommended-label {
  position: absolute;
  top: -12px;
  left: 50%;
  transform: translateX(-50%);
  padding: 4px 14px;
  border-radius: 14px;
  color: white;
  background: var(--el-color-primary);
  font-size: 12px;
  white-space: nowrap;
}

.price {
  color: var(--el-color-primary);
  font-size: 38px;
  font-weight: 700;

  span {
    font-size: 18px;
    margin-right: 2px;
  }
}

.permanent,
.disabled-text {
  color: var(--el-text-color-secondary);
}

.upgrade-price {
  min-height: 24px;
  margin-bottom: 18px;
}

.buy-button {
  width: 100%;
}

.order-summary {
  margin-bottom: 18px;
  padding: 14px;
  border-radius: 8px;
  background: var(--el-fill-color-light);

  div {
    display: flex;
    justify-content: space-between;
    line-height: 28px;
  }
}

.payment-types {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 10px;

  :deep(.el-radio-button__inner) {
    width: 100%;
    border: 1px solid var(--el-border-color) !important;
    border-radius: 6px !important;
    box-shadow: none !important;
  }
}

@media (max-width: 767px) {
  .upgrade-page {
    padding: 20px 14px;
  }

  .page-header {
    align-items: flex-start;
    flex-direction: column;
  }

  .plan-list {
    grid-template-columns: 1fr;
  }
}
</style>
