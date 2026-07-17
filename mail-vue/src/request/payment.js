import http from '@/axios/index.js';

export function paymentPlans() {
    return http.get('/payment/plans');
}
