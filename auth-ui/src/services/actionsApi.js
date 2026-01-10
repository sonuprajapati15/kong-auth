import {rule_server} from "./http";

// Base path from your postman examples
const BASE = "/admin/v1/api/actions";

export async function listActionsApi() {
    const res = await rule_server.get(BASE);
    return res.data;
}

export async function getActionApi(id) {
    const res = await rule_server.get(`${BASE}/${id}`);
    return res.data;
}

export async function createActionApi(payload) {
    // payload: { name, values, comment }
    const res = await rule_server.post(BASE, payload);
    return res.data;
}

// IMPORTANT: confirm your backend supports PUT or PATCH and expected body
export async function updateActionApi(id, payload) {
    const res = await rule_server.put(`${BASE}/${id}`, payload);
    return res.data;
}

export async function deleteActionApi(id) {
    const res = await http.delete(`${BASE}/${id}`);
    return res.data;
}