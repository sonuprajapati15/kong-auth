import { rule_server } from "./http";

const BASE = "/admin/v1/api/webhook";

export async function listWebhooksApi() {
    const res = await rule_server.get(BASE);
    return res.data;
}

export async function getWebhookApi(id) {
    const res = await rule_server.get(`${BASE}/${id}`);
    return res.data;
}

export async function createWebhookApi(payload) {
    // payload matches your API contract (camelCase keys like authType, bodyFields, etc)
    const res = await rule_server.post(BASE, payload);
    return res.data;
}

export async function updateWebhookApi(payload) {
    const res = await rule_server.put(BASE, payload);
    return res.data;
}

export async function deleteWebhookApi(id) {
    const res = await rule_server.delete(`${BASE}/${id}`);
    return res.data;
}