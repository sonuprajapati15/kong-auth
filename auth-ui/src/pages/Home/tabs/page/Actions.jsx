import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import "./css/RuleBuilder.css";
import { createRuleApi, getRuleApi, updateRuleApi, deleteRuleApi } from "../../services/rulesApi.js";
import { getAllGroupsByName } from "../../services/groupApi.js";
import { listDefaultValuesMeta } from "../../services/defaultValuesApi.js";
import { listFieldsApi } from "../../services/fieldsApi.js";
import { listActionsApi } from "../../services/actionsApi.js";
import { listWebhooksApi } from "../../services/webhookApi.js";
import { listSmtpConfigsApi } from "../../services/smtp.js";

/**
 * Changes requested:
 * 1) Each action has its own field_type.
 * 2) After selecting an action, show a chips input to capture action values.
 * 3) Replace request payload "action_id": [...] with "applicableActions": [
 *      { id, field_type, values: [FieldType] }
 *    ]
 *
 * FieldType (backend):
 *  {
 *    type: DataTypeEnums.Type,
 *    stringValue, boolValue, localDate, localDateTime, localTime, doubleValue, intValue
 *  }
 *
 * Notes:
 * - listActionsApi response uses: field_type, default_values, field_name, id
 * - We use action.field_type to decide input type and how to serialize chip values.
 */

function useDebouncedValue(value, delayMs) {
    const [debounced, setDebounced] = useState(value);
    useEffect(() => {
        const t = setTimeout(() => setDebounced(value), delayMs);
        return () => clearTimeout(t);
    }, [value, delayMs]);
    return debounced;
}

function toDataType(valueType) {
    return String(valueType || "").toUpperCase();
}

function getActionLabel(a) {
    return (
        a?.field_name ||
        a?.fieldName ||
        a?.name ||
        a?.field ||
        a?.comment ||
        a?.id ||
        "—"
    );
}

function getWebhookLabel(w) {
    return w?.name || w?.id || "—";
}

function getSmtpLabel(s) {
    return s?.config_name || s?.configName || s?.mail_username || s?.id || "—";
}

function getFieldValueLabel(v) {
    if (v == null) return "";
    if (typeof v === "string" || typeof v === "number" || typeof v === "boolean") return String(v);
    if (v.localDate) return v.localDate;
    if (v.localDateTime) return v.localDateTime;
    if (v.time) return v.time;
    if (v.intValue != null) return String(v.intValue);
    if (v.doubleValue != null) return String(v.doubleValue);
    if (v.stringValue != null) return String(v.stringValue);
    if (v.boolValue != null) return String(v.boolValue);
    if (v.booleanValue != null) return String(v.booleanValue);
    try {
        return JSON.stringify(v);
    } catch {
        return String(v);
    }
}

function normalizeFieldValueKey(v) {
    if (v == null) return "";
    if (typeof v === "string" || typeof v === "number" || typeof v === "boolean") return String(v);
    if (v.localDate) return `DATE:${v.localDate}`;
    if (v.localDateTime) return `DATETIME:${v.localDateTime}`;
    if (v.time) return `TIME:${v.time}`;
    if (v.localTime) return `TIME:${v.localTime}`;
    if (v.intValue != null) return `INT:${v.intValue}`;
    if (v.doubleValue != null) return `DOUBLE:${v.doubleValue}`;
    if (v.stringValue != null) return `STRING:${v.stringValue}`;
    if (v.boolValue != null) return `BOOLEAN:${v.boolValue}`;
    if (v.booleanValue != null) return `BOOLEAN:${v.booleanValue}`;
    return `JSON:${getFieldValueLabel(v)}`;
}

function parseNormalizedKeyToFieldType(key) {
    // key like: "INT:20", "DATE:2026-01-12", "STRING:abc", "BOOLEAN:true"
    const idx = key.indexOf(":");
    if (idx <= 0) return null;
    const type = key.slice(0, idx);
    const raw = key.slice(idx + 1);

    switch (type) {
        case "INT":
            return { type: "INT", intValue: Number(raw) };
        case "DOUBLE":
            return { type: "DOUBLE", doubleValue: Number(raw) };
        case "STRING":
            return { type: "STRING", stringValue: raw };
        case "BOOLEAN":
            return { type: "BOOLEAN", boolValue: raw === "true" };
        case "DATE":
            return { type: "DATE", localDate: raw };
        case "DATETIME":
            return { type: "DATETIME", localDateTime: raw };
        case "TIME":
            return { type: "TIME", localTime: raw };
        default:
            return { type: "STRING", stringValue: raw };
    }
}

function makeConditionRow() {
    return {
        fieldId: "",
        fieldName: "",
        fieldType: "",
        operator: "",
        selectedValueKeys: []
    };
}

function makeActionRow() {
    return {
        actionId: "",
        actionName: "",
        actionFieldType: "",
        selectedValueKeys: [] // <-- chips for action values
    };
}

export default function RuleBuilder({ mode }) {
    const nav = useNavigate();
    const { id } = useParams();

    const isCreate = mode === "create";
    const isEdit = mode === "edit";

    const [loading, setLoading] = useState(Boolean(isEdit));
    const [saving, setSaving] = useState(false);
    const [err, setErr] = useState("");

    // meta
    const [ruleId, setRuleId] = useState("");
    const [groupId, setGroupId] = useState("");
    const [ruleName, setRuleName] = useState("");
    const [priority, setPriority] = useState(1);
    const [logicalOperator, setLogicalOperator] = useState("AND");
    const [description, setDescription] = useState("");

    // Group autocomplete
    const [groupQuery, setGroupQuery] = useState("");
    const debouncedGroupQuery = useDebouncedValue(groupQuery, 350);
    const [groupLoading, setGroupLoading] = useState(false);
    const [groupOptions, setGroupOptions] = useState([]);
    const [groupDropdownOpen, setGroupDropdownOpen] = useState(false);
    const lastGroupReqId = useRef(0);

    // meta-data for operators/fields/actions/webhooks/smtp
    const [metaLoading, setMetaLoading] = useState(true);
    const [typeOperatorMapping, setTypeOperatorMapping] = useState({});
    const [fields, setFields] = useState([]);
    const [actionsList, setActionsList] = useState([]);
    const [webhooksList, setWebhooksList] = useState([]);
    const [smtpList, setSmtpList] = useState([]);

    // IF blocks
    const [allConditions, setAllConditions] = useState([makeConditionRow()]);
    const [anyConditions, setAnyConditions] = useState([makeConditionRow()]);

    // THEN: actions + webhook + smtp
    const [actions, setActions] = useState([makeActionRow()]);
    const [webhookId, setWebhookId] = useState("");
    const [smtpId, setSmtpId] = useState("");
    const [smtpRecipientsText, setSmtpRecipientsText] = useState("");
    const [smtpSubject, setSmtpSubject] = useState("");
    const [smtpBody, setSmtpBody] = useState("");

    const fieldsById = useMemo(() => new Map(fields.map((f) => [f.id, f])), [fields]);
    const actionsById = useMemo(() => new Map(actionsList.map((a) => [a.id, a])), [actionsList]);

    const canSubmit = useMemo(() => groupId.trim() && ruleName.trim(), [groupId, ruleName]);

    // Load meta
    useEffect(() => {
        (async () => {
            setErr("");
            setMetaLoading(true);
            try {
                const [metaRes, fieldsRes, actionsRes, webhooksRes, smtpRes] = await Promise.all([
                    listDefaultValuesMeta(),
                    listFieldsApi(),
                    listActionsApi(),
                    listWebhooksApi(),
                    listSmtpConfigsApi()
                ]);

                const mapping = metaRes?.type_operator_mapping || metaRes?.data?.type_operator_mapping || {};
                setTypeOperatorMapping(mapping);

                const fieldsList = Array.isArray(fieldsRes) ? fieldsRes : fieldsRes?.data ?? [];
                setFields(fieldsList.filter((f) => (f.db_status || "").toUpperCase() === "ACTIVE" || !f.db_status));

                const acts = Array.isArray(actionsRes) ? actionsRes : actionsRes?.data ?? [];
                setActionsList(acts.filter((a) => (a.db_status || "").toUpperCase() === "ACTIVE" || !a.db_status));

                const wh = Array.isArray(webhooksRes) ? webhooksRes : webhooksRes?.data ?? [];
                setWebhooksList(wh);

                const sm = Array.isArray(smtpRes) ? smtpRes : smtpRes?.data ?? [];
                setSmtpList(sm);
            } catch (e) {
                setErr(e?.response?.data?.message || e.message || "Failed to load meta data");
            } finally {
                setMetaLoading(false);
            }
        })();
    }, []);

    // Load rule in edit (best-effort mapping)
    useEffect(() => {
        if (!isEdit) return;

        (async () => {
            setErr("");
            setLoading(true);
            try {
                const r = await getRuleApi(id);

                setRuleId(r.id || "");
                setGroupId(r.group_id || "");
                setGroupQuery(r.group_id || "");
                setRuleName(r.rule_name || "");
                setPriority(Number(r.priority || 1));
                setLogicalOperator(r.logica_Operator || "AND");
                setDescription(r.description || "");

                setWebhookId(r.webhook_id || "");
                setSmtpId(r.smtp_details?.id || "");
                setSmtpRecipientsText((r.smtp_details?.recipient_ids || []).join(", "));
                setSmtpSubject(r.smtp_details?.subject || "");
                setSmtpBody(r.smtp_details?.body || "");

                const allBlock = Array.isArray(r.conditions) ? r.conditions.find((c) => (c.logica_Operator || "").toUpperCase() === "AND") : null;
                const anyBlock = Array.isArray(r.conditions) ? r.conditions.find((c) => (c.logica_Operator || "").toUpperCase() === "OR") : null;

                setAllConditions(mapBackendBlockToRows(allBlock, fieldsById));
                setAnyConditions(mapBackendBlockToRows(anyBlock, fieldsById));

                // New: applicableActions support (if backend sends it)
                if (Array.isArray(r.applicableActions) && r.applicableActions.length) {
                    setActions(
                        r.applicableActions.map((aa) => ({
                            actionId: aa.id || "",
                            actionName: "",
                            actionFieldType: aa.field_type || "",
                            selectedValueKeys: (aa.values || []).map(normalizeFieldValueKey).filter(Boolean)
                        }))
                    );
                } else {
                    // fallback: old action_id if present
                    setActions(
                        Array.isArray(r.action_id) && r.action_id.length
                            ? r.action_id.map((aid) => ({ actionId: aid, actionName: "", actionFieldType: "", selectedValueKeys: [] }))
                            : [makeActionRow()]
                    );
                }
            } catch (e) {
                setErr(e?.response?.data?.message || e.message || "Failed to load rule");
            } finally {
                setLoading(false);
            }
        })();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [id, isEdit]);

    function mapBackendBlockToRows(block, fieldsByIdMap) {
        const fovs = block?.field_operator_values;
        if (!Array.isArray(fovs) || fovs.length === 0) return [makeConditionRow()];

        return fovs.map((fov) => {
            const fieldId = fov.field_id || "";
            const field = fieldsByIdMap?.get ? fieldsByIdMap.get(fieldId) : null;
            const fieldType = field?.value_type || fov.data_type || "";
            const operator = fov.operator || "";
            const dvs = Array.isArray(fov.default_values) ? fov.default_values : [];
            const selectedValueKeys = dvs.map(normalizeFieldValueKey).filter(Boolean);

            return {
                fieldId,
                fieldName: field?.name || "",
                fieldType: toDataType(fieldType),
                operator,
                selectedValueKeys
            };
        });
    }

    // Group autocomplete
    useEffect(() => {
        const q = (debouncedGroupQuery || "").trim();
        if (q.length < 4) {
            setGroupOptions([]);
            setGroupDropdownOpen(false);
            return;
        }

        const reqId = ++lastGroupReqId.current;

        (async () => {
            setGroupLoading(true);
            try {
                const res = await getAllGroupsByName(q);
                const list = Array.isArray(res) ? res : res?.data ?? [];
                if (reqId !== lastGroupReqId.current) return;
                setGroupOptions(list);
                setGroupDropdownOpen(true);
            } catch {
                if (reqId !== lastGroupReqId.current) return;
                setGroupOptions([]);
                setGroupDropdownOpen(false);
            } finally {
                if (reqId === lastGroupReqId.current) setGroupLoading(false);
            }
        })();
    }, [debouncedGroupQuery]);

    function onSelectGroup(g) {
        const idValue = g.id || g._id || g.group_id || "";
        setGroupId(idValue);
        setGroupQuery(g.group_name || g.groupName || idValue);
        setGroupDropdownOpen(false);
        setGroupOptions([]);
    }

    function clearSelectedGroup() {
        setGroupId("");
        setGroupQuery("");
        setGroupOptions([]);
        setGroupDropdownOpen(false);
    }

    function addAllCondition() {
        setAllConditions((prev) => [...prev, makeConditionRow()]);
    }
    function addAnyCondition() {
        setAnyConditions((prev) => [...prev, makeConditionRow()]);
    }

    function addActionRow() {
        setActions((prev) => [...prev, makeActionRow()]);
    }

    function updateCondition(setter, idx, patch) {
        setter((prev) => prev.map((row, i) => (i === idx ? { ...row, ...patch } : row)));
    }

    function removeCondition(setter, idx) {
        setter((prev) => prev.filter((_, i) => i !== idx));
    }

    function updateAction(idx, patch) {
        setActions((prev) => prev.map((row, i) => (i === idx ? { ...row, ...patch } : row)));
    }

    function removeAction(idx) {
        setActions((prev) => prev.filter((_, i) => i !== idx));
    }

    function onFieldChange(setter, idx, fieldId) {
        const f = fieldsById.get(fieldId);
        const valueType = f?.value_type || "";
        const ops = typeOperatorMapping?.[valueType] || [];
        const defaultOp = ops.includes("EQUALS") ? "EQUALS" : ops[0] || "";

        updateCondition(setter, idx, {
            fieldId,
            fieldName: f?.name || "",
            fieldType: valueType,
            operator: defaultOp,
            selectedValueKeys: []
        });
    }

    function onOperatorChange(setter, idx, op) {
        updateCondition(setter, idx, { operator: op });
    }

    function setConditionChips(setter, idx, keys) {
        updateCondition(setter, idx, { selectedValueKeys: keys });
    }

    function onActionSelect(idx, actionId) {
        const a = actionsById.get(actionId);
        updateAction(idx, {
            actionId,
            actionName: getActionLabel(a),
            actionFieldType: a?.field_type || a?.fieldType || "",
            selectedValueKeys: [] // reset values when action changes
        });
    }

    function setActionChips(idx, keys) {
        updateAction(idx, { selectedValueKeys: keys });
    }

    function buildFieldOperatorValue(row) {
        const f = row.fieldId ? fieldsById.get(row.fieldId) : null;
        const dataType = toDataType(row.fieldType || f?.value_type || "");

        return {
            field_id: row.fieldId,
            data_type: dataType,
            operator: row.operator,
            default_values: (row.selectedValueKeys || [])
                .map(parseNormalizedKeyToFieldType)
                .filter(Boolean)
        };
    }

    function buildApplicableAction(row) {
        const a = row.actionId ? actionsById.get(row.actionId) : null;
        const fieldType = toDataType(row.actionFieldType || a?.field_type || a?.fieldType || "");

        return {
            id: row.actionId,
            field_type: fieldType,
            values: (row.selectedValueKeys || [])
                .map(parseNormalizedKeyToFieldType)
                .filter(Boolean)
        };
    }

    function validateConditionsBlock(rows, label) {
        for (const [i, r] of rows.entries()) {
            if (!r.fieldId) return `${label}: field is required (row ${i + 1})`;
            if (!r.operator) return `${label}: operator is required (row ${i + 1})`;
            if (!Array.isArray(r.selectedValueKeys) || r.selectedValueKeys.length === 0) {
                return `${label}: select/enter at least one value (row ${i + 1})`;
            }
        }
        return "";
    }

    function validateActions() {
        for (const [i, a] of actions.entries()) {
            if (!a.actionId) return `Actions: action is required (row ${i + 1})`;
            // If action has a field_type, require at least 1 value (you can relax this if needed)
            const ft = toDataType(a.actionFieldType || (actionsById.get(a.actionId)?.field_type ?? ""));
            if (ft && (!Array.isArray(a.selectedValueKeys) || a.selectedValueKeys.length === 0)) {
                return `Actions: enter/select value(s) for "${a.actionName || a.actionId}" (row ${i + 1})`;
            }
        }
        return "";
    }

    async function onSave() {
        setErr("");
        setSaving(true);
        try {
            if (!groupId.trim()) throw new Error("group_id is required");
            if (!ruleName.trim()) throw new Error("rule_name is required");

            const v1 = validateConditionsBlock(allConditions, "ALL block");
            if (v1) throw new Error(v1);
            const v2 = validateConditionsBlock(anyConditions, "ANY block");
            if (v2) throw new Error(v2);

            const v3 = validateActions();
            if (v3) throw new Error(v3);

            const allFov = allConditions.map(buildFieldOperatorValue);
            const anyFov = anyConditions.map(buildFieldOperatorValue);

            const applicableActions = actions
                .filter((a) => a.actionId)
                .map(buildApplicableAction);

            const payload = {
                ...(isEdit ? { id } : ruleId.trim() ? { id: ruleId.trim() } : {}),
                group_id: groupId.trim(),
                rule_name: ruleName.trim(),
                priority: Number(priority),
                logica_Operator: logicalOperator,

                conditions: [
                    { logica_Operator: "AND", field_operator_values: allFov },
                    { logica_Operator: "OR", field_operator_values: anyFov }
                ],

                // ✅ NEW FIELD instead of action_id
                applicableActions,

                webhook_id: webhookId || undefined,

                smtp_details:
                    smtpId || smtpRecipientsText.trim() || smtpSubject.trim() || smtpBody.trim()
                        ? {
                            id: smtpId,
                            recipient_ids: smtpRecipientsText
                                .split(",")
                                .map((s) => s.trim())
                                .filter(Boolean),
                            subject: smtpSubject,
                            body: smtpBody
                        }
                        : undefined,

                description: description.trim()
            };

            if (isCreate) await createRuleApi(payload);
            else await updateRuleApi(payload);

            nav("/home/rules", { replace: true });
        } catch (e) {
            setErr(e?.response?.data?.message || e.message || "Save failed");
        } finally {
            setSaving(false);
        }
    }

    async function onDelete() {
        if (!isEdit) return;
        const ok = confirm("Delete this rule?");
        if (!ok) return;

        setErr("");
        setSaving(true);
        try {
            await deleteRuleApi(id);
            nav("/home/rules", { replace: true });
        } catch (e) {
            setErr(e?.response?.data?.message || e.message || "Delete failed");
        } finally {
            setSaving(false);
        }
    }

    function buildFieldChipsOptions(field) {
        const values = field?.values || [];
        return values.map((v) => ({ value: normalizeFieldValueKey(v), label: getFieldValueLabel(v) }));
    }

    function buildActionChipsOptions(actionObj) {
        // if backend provides default_values for actions, use it as picklist
        const values = actionObj?.default_values || actionObj?.defaultValues || [];
        if (!Array.isArray(values) || values.length === 0) return [];
        return values.map((v) => ({ value: normalizeFieldValueKey(v), label: getFieldValueLabel(v) }));
    }

    return (
        <div className="rbPage">
            <div className="rbTop">
                <div>
                    <div className="rbTitle">Automation Rule Builder</div>
                    <div className="rbSub">Create rules to automate actions based on conditions.</div>
                </div>

                <div className="rbTopRight">
                    {isEdit ? (
                        <button className="btnDanger" onClick={onDelete} disabled={saving || loading}>
                            Delete
                        </button>
                    ) : null}
                    <button className="btnSecondary" onClick={() => nav(-1)} disabled={saving}>
                        Cancel
                    </button>
                    <button className="btnPrimary" onClick={onSave} disabled={!canSubmit || saving || loading}>
                        {saving ? "Saving..." : "Save Rule"}
                    </button>
                </div>
            </div>

            {err ? <div className="error">{err}</div> : null}
            {loading || metaLoading ? (
                <div className="card">
                    <div className="empty">Loading…</div>
                </div>
            ) : null}

            <div className="card">
                {/* ---- TOP META ---- */}
                <div className="rbMeta">
                    <div className="rbMetaGrid">
                        <label className="field">
                            <span className="label">Rule ID (optional for create)</span>
                            <input className="input" value={isEdit ? id || "" : ruleId} onChange={(e) => setRuleId(e.target.value)} disabled={isEdit} />
                        </label>

                        {/* Group autocomplete */}
                        <label className="field rbGroupAuto">
                            <span className="label">Group</span>

                            <div className="rbAutoWrap">
                                <input
                                    className="input"
                                    value={groupQuery}
                                    onChange={(e) => {
                                        const v = e.target.value;
                                        setGroupQuery(v);
                                        if (groupId) setGroupId("");
                                    }}
                                    placeholder="Type 4+ chars to search group"
                                    onFocus={() => {
                                        if ((groupOptions || []).length) setGroupDropdownOpen(true);
                                    }}
                                    onBlur={() => setTimeout(() => setGroupDropdownOpen(false), 150)}
                                />

                                {groupId ? (
                                    <button className="rbClearBtn" type="button" onClick={clearSelectedGroup} title="Clear selected group">
                                        ×
                                    </button>
                                ) : null}

                                {groupDropdownOpen ? (
                                    <div className="rbDropdown" role="listbox">
                                        {groupLoading ? (
                                            <div className="rbDropItem rbDropItem--muted">Searching…</div>
                                        ) : groupOptions.length === 0 ? (
                                            <div className="rbDropItem rbDropItem--muted">No groups found</div>
                                        ) : (
                                            groupOptions.map((g) => {
                                                const gid = g.id || g._id || g.group_id || "";
                                                const gname = g.group_name || g.groupName || "—";
                                                return (
                                                    <button
                                                        key={gid || gname}
                                                        type="button"
                                                        className="rbDropItem"
                                                        onMouseDown={(e) => e.preventDefault()}
                                                        onClick={() => onSelectGroup(g)}
                                                    >
                                                        <div className="rbDropName">{gname}</div>
                                                        <div className="rbDropSub">{gid}</div>
                                                    </button>
                                                );
                                            })
                                        )}
                                    </div>
                                ) : null}
                            </div>

                            <div className="rbSelectedId">
                                Selected group_id: <span className="rbMono">{groupId || "—"}</span>
                            </div>
                        </label>

                        <label className="field">
                            <span className="label">Rule name</span>
                            <input className="input" value={ruleName} onChange={(e) => setRuleName(e.target.value)} />
                        </label>

                        <label className="field">
                            <span className="label">Priority</span>
                            <input className="input" type="number" min={1} value={priority} onChange={(e) => setPriority(e.target.value)} />
                        </label>

                        <label className="field rbMetaDesc">
                            <span className="label">Description</span>
                            <input className="input" value={description} onChange={(e) => setDescription(e.target.value)} />
                        </label>
                    </div>
                </div>

                {/* ---- IF ---- */}
                <div className="rbSection">
                    <div className="rbSectionTitle">IF</div>

                    <div className="block">
                        <div className="blockTitle">ALL of the following conditions are true:</div>

                        {allConditions.map((row, idx) => {
                            const f = row.fieldId ? fieldsById.get(row.fieldId) : null;
                            const fType = row.fieldType || f?.value_type || "";
                            const ops = typeOperatorMapping?.[fType] || [];
                            const usePickList = Array.isArray(f?.values) && f.values.length > 0;

                            return (
                                <div key={idx} className="condRow4">
                                    <select className="input" value={row.fieldId} onChange={(e) => onFieldChange(setAllConditions, idx, e.target.value)}>
                                        <option value="">Select field</option>
                                        {fields.map((ff) => (
                                            <option key={ff.id} value={ff.id}>
                                                {ff.name} ({ff.value_type})
                                            </option>
                                        ))}
                                    </select>

                                    <select className="input" value={row.operator} onChange={(e) => onOperatorChange(setAllConditions, idx, e.target.value)} disabled={!row.fieldId}>
                                        <option value="">{row.fieldId ? "Select operator" : "Select field first"}</option>
                                        {ops.map((op) => (
                                            <option key={op} value={op}>{op}</option>
                                        ))}
                                    </select>

                                    <ChipsValueBox
                                        disabled={!row.fieldId}
                                        mode={usePickList ? "PICKLIST" : "FREE_TEXT"}
                                        options={usePickList ? buildFieldChipsOptions(f) : []}
                                        valueKeys={row.selectedValueKeys}
                                        onChange={(keys) => setConditionChips(setAllConditions, idx, keys)}
                                        valueType={fType}
                                    />

                                    <button className="xBtn" type="button" onClick={() => removeCondition(setAllConditions, idx)} title="Remove">×</button>
                                </div>
                            );
                        })}

                        <button className="addLink" type="button" onClick={addAllCondition}>+ Add Condition</button>
                    </div>

                    <div className="andBar">AND</div>

                    <div className="block">
                        <div className="blockTitle">ANY of the following conditions are true:</div>

                        {anyConditions.map((row, idx) => {
                            const f = row.fieldId ? fieldsById.get(row.fieldId) : null;
                            const fType = row.fieldType || f?.value_type || "";
                            const ops = typeOperatorMapping?.[fType] || [];
                            const usePickList = Array.isArray(f?.values) && f.values.length > 0;

                            return (
                                <div key={idx} className="condRow4">
                                    <select className="input" value={row.fieldId} onChange={(e) => onFieldChange(setAnyConditions, idx, e.target.value)}>
                                        <option value="">Select field</option>
                                        {fields.map((ff) => (
                                            <option key={ff.id} value={ff.id}>
                                                {ff.name} ({ff.value_type})
                                            </option>
                                        ))}
                                    </select>

                                    <select className="input" value={row.operator} onChange={(e) => onOperatorChange(setAnyConditions, idx, e.target.value)} disabled={!row.fieldId}>
                                        <option value="">{row.fieldId ? "Select operator" : "Select field first"}</option>
                                        {ops.map((op) => (
                                            <option key={op} value={op}>{op}</option>
                                        ))}
                                    </select>

                                    <ChipsValueBox
                                        disabled={!row.fieldId}
                                        mode={usePickList ? "PICKLIST" : "FREE_TEXT"}
                                        options={usePickList ? buildFieldChipsOptions(f) : []}
                                        valueKeys={row.selectedValueKeys}
                                        onChange={(keys) => setConditionChips(setAnyConditions, idx, keys)}
                                        valueType={fType}
                                    />

                                    <button className="xBtn" type="button" onClick={() => removeCondition(setAnyConditions, idx)} title="Remove">×</button>
                                </div>
                            );
                        })}

                        <button className="addLink" type="button" onClick={addAnyCondition}>+ Add Condition</button>
                    </div>
                </div>

                {/* ---- THEN ---- */}
                <div className="rbSection">
                    <div className="rbSectionTitle">THEN</div>

                    <div className="block">
                        {/* Webhook */}
                        <div className="block" style={{ backgroundColor: "#f9f9f9" }}>
                            <div className="blockTitle">Webhook Info</div>
                            <div className="thenGrid">
                                <label className="field thenSpan2">
                                    <span className="label">Webhook</span>
                                    <select className="input" value={webhookId} onChange={(e) => setWebhookId(e.target.value)}>
                                        <option value="">None</option>
                                        {webhooksList.map((w) => (
                                            <option key={w.id} value={w.id}>{getWebhookLabel(w)}</option>
                                        ))}
                                    </select>
                                </label>
                            </div>
                        </div>

                        {/* SMTP */}
                        <div className="block" style={{ marginTop: "16px", backgroundColor: "#f9f9f9" }}>
                            <div className="blockTitle">Send Mail Info</div>
                            <div className="thenGrid">
                                <label className="field thenSpan2">
                                    <span className="label">SMTP Server</span>
                                    <select className="input" value={smtpId} onChange={(e) => setSmtpId(e.target.value)}>
                                        <option value="">None</option>
                                        {smtpList.map((s) => (
                                            <option key={s.id} value={s.id}>{getSmtpLabel(s)}</option>
                                        ))}
                                    </select>
                                </label>

                                <label className="field thenSpan2">
                                    <span className="label">Recipient Ids (comma separated)</span>
                                    <input className="input" value={smtpRecipientsText} onChange={(e) => setSmtpRecipientsText(e.target.value)} placeholder="user1@example.com, user2@example.com" />
                                </label>

                                <label className="field">
                                    <span className="label">Subject</span>
                                    <input className="input" value={smtpSubject} onChange={(e) => setSmtpSubject(e.target.value)} placeholder="Notification" />
                                </label>

                                <label className="field thenSpan2">
                                    <span className="label">Mail Body</span>
                                    <input className="input" value={smtpBody} onChange={(e) => setSmtpBody(e.target.value)} placeholder="Rule triggered" />
                                </label>
                            </div>
                        </div>

                        {/* Actions + action values */}
                        <div className="block" style={{ marginTop: "16px", backgroundColor: "#f9f9f9" }}>
                            <div className="blockTitle">Actions</div>

                            {actions.map((a, idx) => {
                                const actionObj = a.actionId ? actionsById.get(a.actionId) : null;
                                const actionName = getActionLabel(actionObj) || a.actionName || "";
                                const actionType = toDataType(a.actionFieldType || actionObj?.field_type || actionObj?.fieldType || "");

                                const pickOptions = buildActionChipsOptions(actionObj);
                                const actionUsePickList = pickOptions.length > 0;

                                return (
                                    <div key={idx} className="actionBox">
                                        <div className="actionRow2">
                                            <div className="actionLabel">Action:</div>

                                            <select className="input" value={a.actionId} onChange={(e) => onActionSelect(idx, e.target.value)}>
                                                <option value="">Select action</option>
                                                {actionsList.map((x) => (
                                                    <option key={x.id} value={x.id}>
                                                        {getActionLabel(x)} ({toDataType(x.field_type || x.fieldType)})
                                                    </option>
                                                ))}
                                            </select>

                                            <button className="xBtn" type="button" onClick={() => removeAction(idx)} title="Remove">×</button>
                                        </div>

                                        {a.actionId ? (
                                            <>
                                                <div className="actionHint">
                                                    Selected: <b>{actionName}</b> • Type: <b>{actionType || "—"}</b> • ID:{" "}
                                                    <span className="rbMono">{a.actionId}</span>
                                                </div>

                                                <div className="actionValues">
                                                    <div className="label">Action values</div>
                                                    <ChipsValueBox
                                                        disabled={false}
                                                        mode={actionUsePickList ? "PICKLIST" : "FREE_TEXT"}
                                                        options={pickOptions}
                                                        valueKeys={a.selectedValueKeys}
                                                        onChange={(keys) => setActionChips(idx, keys)}
                                                        valueType={actionType || "STRING"}
                                                    />
                                                </div>
                                            </>
                                        ) : null}
                                    </div>
                                );
                            })}

                            <button className="addLink" type="button" onClick={addActionRow}>+ Add Action</button>
                        </div>
                    </div>
                </div>

                <div className="rbBottom">
                    <button className="btnSecondary" type="button" onClick={() => nav(-1)} disabled={saving}>Cancel</button>
                    <button className="btnPrimary" type="button" onClick={onSave} disabled={!canSubmit || saving}>
                        {saving ? "Saving..." : "Save Rule"}
                    </button>
                </div>
            </div>
        </div>
    );
}

/**
 * ChipsValueBox:
 * - PICKLIST: dropdown + chips
 * - FREE_TEXT: input + chips (press Enter)
 * Stored values are normalized as "TYPE:value" so we can convert to FieldType objects.
 */
function ChipsValueBox({ mode, options, valueKeys, onChange, disabled, valueType }) {
    const [open, setOpen] = useState(false);
    const [query, setQuery] = useState("");
    const [text, setText] = useState("");

    const selectedSet = useMemo(() => new Set(valueKeys || []), [valueKeys]);

    const filteredOptions = useMemo(() => {
        if (mode !== "PICKLIST") return [];
        const q = query.trim().toLowerCase();
        if (!q) return options;
        return options.filter((o) => (o.label || "").toLowerCase().includes(q));
    }, [mode, options, query]);

    function removeKey(k) {
        onChange((valueKeys || []).filter((x) => x !== k));
    }

    function addKey(k) {
        if (!k) return;
        const next = new Set(valueKeys || []);
        next.add(k);
        onChange(Array.from(next));
    }

    function addFreeTextValue(raw) {
        const v = String(raw || "").trim();
        if (!v) return;
        const type = toDataType(valueType || "STRING");
        addKey(`${type}:${v}`);
        setText("");
    }

    return (
        <div className={`chipsBox ${disabled ? "chipsBox--disabled" : ""}`}>
            <div className="chipsTop">
                <div className="chipsList">
                    {(valueKeys || []).map((k) => (
                        <span key={k} className="chip">
              <span className="chipText">{k.includes(":") ? k.split(":").slice(1).join(":") : k}</span>
              <button type="button" className="chipX" onClick={() => removeKey(k)} disabled={disabled}>
                ×
              </button>
            </span>
                    ))}
                </div>

                {mode === "PICKLIST" ? (
                    <div className="chipsControls">
                        <button type="button" className="chipsBtn" onClick={() => setOpen((s) => !s)} disabled={disabled}>
                            Select values
                        </button>
                    </div>
                ) : (
                    <input
                        className="chipsInput"
                        value={text}
                        onChange={(e) => setText(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === "Enter") {
                                e.preventDefault();
                                addFreeTextValue(text);
                            }
                        }}
                        placeholder="Type value and press Enter"
                        disabled={disabled}
                    />
                )}
            </div>

            {mode === "PICKLIST" && open && !disabled ? (
                <div className="chipsDropdown" onMouseDown={(e) => e.preventDefault()}>
                    <input className="chipsSearch" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search..." />
                    <div className="chipsOptions">
                        {filteredOptions.length === 0 ? (
                            <div className="chipsEmpty">No values</div>
                        ) : (
                            filteredOptions.map((o) => {
                                const picked = selectedSet.has(o.value);
                                return (
                                    <button
                                        key={o.value}
                                        type="button"
                                        className={`chipsOption ${picked ? "chipsOption--picked" : ""}`}
                                        onClick={() => addKey(o.value)}
                                    >
                                        {o.label}
                                    </button>
                                );
                            })
                        )}
                    </div>
                </div>
            ) : null}
        </div>
    );
}