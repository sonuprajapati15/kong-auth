import { rule_server } from "./http";

const BASE = "/admin/v1/api/rules";

export async function listRulesApi() {
    const res = await rule_server.get(BASE);
    return res.data;
}

export async function getRuleApi(id) {
    // you wrote: GET /admin/v1/api/rules{id}  -> assumed /admin/v1/api/rules/{id}
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

/**
 * DELETE style not fully specified (you wrote DELETE /admin/v1/api/rules).
 * Common options:
 * 1) DELETE /rules/{id}
 * 2) DELETE /rules?id=xxx
 * 3) DELETE /rules with body { id }
 *
 * I implemented query param: DELETE /rules?id=xxx
 * If your backend is different, tell me and I’ll adjust.
 */
export async function deleteRuleApi(id) {
    const res = await rule_server.delete(BASE, { params: { id } });
    return res.data;
}