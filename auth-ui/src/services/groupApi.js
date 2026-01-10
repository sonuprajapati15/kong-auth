import { rule_server } from "./http";

const BASE = "/admin/v1/api/group";

export async function listGroupsApi() {
    const res = await rule_server.get(BASE);
    return res.data;
}

export async function getGroupApi(id) {
    const res = await rule_server.get(`${BASE}/${id}`);
    return res.data;
}

export async function createGroupApi({ group_name, parent_group_id }) {
    const res = await http.post(BASE, { group_name, parent_group_id });
    return res.data;
}

export async function updateGroupRulesApi({ id, groupName, rules_ids }) {
    // as per your postman
    const res = await http.put(`${BASE}/`, { id, groupName, rules_ids });
    return res.data;
}

export async function deleteGroupApi(id) {
    const res = await http.delete(`${BASE}/${id}`);
    return res.data;
}