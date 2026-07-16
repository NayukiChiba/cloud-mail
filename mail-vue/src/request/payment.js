import http from '@/axios/index.js';

export function paymentPlans() {
    return http.get('/payment/plans');
}

export function paymentCreateOrder(params) {
    return http.post('/payment/order', params);
}

export function paymentOrder(orderId) {
    return http.get(`/payment/order/${orderId}`);
}
