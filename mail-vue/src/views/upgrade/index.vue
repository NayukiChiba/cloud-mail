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
          <div class="plan-features">
            <div class="features-title">{{ $t('planHighlights') }}</div>
            <ul>
              <li v-for="featureKey in getPlanFeatureKeys(plan.code)" :key="featureKey">
                {{ $t(featureKey) }}
              </li>
            </ul>
          </div>
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
              @click="goToAfdian"
          >
            {{ $t('goToAfdian') }}
          </el-button>
        </el-card>
      </div>
    </el-skeleton>
  </div>
</template>

<script setup>
import { onMounted, reactive, ref } from 'vue';
import { paymentPlans } from '@/request/payment.js';

const loading = ref(true);
const AFDIAN_URL = 'https://ifdian.net/item/02d026cc819811f196d552540025c377';
const PLAN_FEATURE_KEYS = Object.freeze({
  'multi-domain': [
    'multiDomainFeatureDomains',
    'multiDomainFeatureAccounts',
    'multiDomainFeatureSend'
  ],
  'multi-account': [
    'multiAccountFeatureDomains',
    'multiAccountFeatureAccounts',
    'multiAccountFeatureSend'
  ],
  premium: [
    'premiumFeatureDomains',
    'premiumFeatureExclusiveDomain',
    'premiumFeatureAccounts',
    'premiumFeatureSend'
  ]
});
const planData = reactive({
  currentRoleId: null,
  currentRoleName: '',
  plans: []
});

function getPlanFeatureKeys(planCode) {
  return PLAN_FEATURE_KEYS[planCode] || [];
}

async function loadPlans() {
  loading.value = true;
  try {
    const data = await paymentPlans();
    Object.assign(planData, data);
  } finally {
    loading.value = false;
  }
}

function goToAfdian() {
  window.location.href = AFDIAN_URL;
}

onMounted(loadPlans);
</script>

<style lang="scss" scoped>
.upgrade-page {
  max-width: 1380px;
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

.plan-list {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 20px;
}

.plan-card {
  position: relative;
  text-align: center;
  overflow: visible;

  :deep(.el-card__body) {
    display: flex;
    flex-direction: column;
    height: 100%;
    box-sizing: border-box;
  }

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

.plan-features {
  min-height: 152px;
  text-align: left;

  .features-title {
    margin-bottom: 10px;
    color: var(--el-text-color-primary);
    font-size: 14px;
    font-weight: 600;
  }

  ul {
    margin: 0;
    padding-left: 20px;
    color: var(--el-text-color-regular);
    line-height: 30px;
  }

  li::marker {
    color: var(--el-color-primary);
  }
}

.upgrade-price {
  min-height: 24px;
  margin-bottom: 18px;
}

.buy-button {
  width: 100%;
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

@media (min-width: 768px) and (max-width: 1100px) {
  .plan-list {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
</style>
