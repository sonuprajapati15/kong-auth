import { rule_server } from "./http";

const BASE = "/admin/v1/api/rules";

export async function listRulesApi() {
    const res = await rule_server.get(BASE);
    return res.data;
}

export async function getRuleApi(id) {
    const res = await rule_server.get(`${BASE}/${id}`);
    return res.data;
}

export async function createRuleApi(payload) {
    const res = await rule_server.post(BASE, payload);
    return res.data;
}

export async function updateRuleApi(payload) {
    const res = await rule_server.put(BASE, payload);
    return res.data;
}

export async function deleteRuleApi(id) {
    const res =  await rule_server.delete(`${BASE}/${id}`);
    return res.data;
}