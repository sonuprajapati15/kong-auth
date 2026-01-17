import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import "./css/RuleBuilder.css";
import { createRuleApi, getRuleApi, updateRuleApi, deleteRuleApi } from "../../services/rulesApi.js";
import { getAllGroupsByName } from "../../services/groupApi.js";
import { listDefaultValuesMeta } from "../../services/defaultValuesApi.js";
import { listFieldsApi } from "../../services/fieldsApi.js";
import { listActionsApi } from "../../services/actionsApi.js";

// small debounce helper
function useDebouncedValue(value, delayMs) {
    const [debounced, setDebounced] = useState(value);
    useEffect(() => {
        const t = setTimeout(() => setDebounced(value), delayMs);
        return () => clearTimeout(t);
    }, [value, delayMs]);
    return debounced;
}

// ---- helpers for Field values -> usable label/value ----
function getFieldValueLabel(v) {
    if (v == null) return "";
    if (typeof v === "string" || typeof v === "number" || typeof v === "boolean") return String(v);

    // your values format examples: { localDate, type }, maybe { localDateTime }, { time }, etc
    if (v.localDate) return v.localDate;
    if (v.localDateTime) return v.localDateTime;
    if (v.time) return v.time;
    if (v.value != null) return String(v.value);

    try {
        return JSON.stringify(v);
    } catch {
        return String(v);
    }
}

function normalizeFieldValueKey(v) {
    // stable key for selecting/multi-select
    if (v == null) return "";
    if (typeof v === "string" || typeof v === "number" || typeof v === "boolean") return String(v);
    if (v.localDate) return `DATE:${v.localDate}`;
    if (v.localDateTime) return `DATETIME:${v.localDateTime}`;
    if (v.time) return `TIME:${v.time}`;
    if (v.value != null) return `VAL:${String(v.value)}`;
    return `JSON:${getFieldValueLabel(v)}`;
}

// ---- condition row shape ----
// valueMode: "PICKLIST" (use field.values multi-select) | "INPUT" (manual)
// valueInputType: DATE/DATETIME/TIME/INT/DOUBLE/BOOLEAN/STRING
function makeConditionRow() {
    return {
        fieldId: "",
        fieldName: "",
        fieldType: "", // value_type
        operator: "",
        // for picklist:
        selectedValueKeys: [], // multi-select keys
        // for manual entry:
        inputValue: ""
    };
}

// ---- action row shape ----
function makeActionRow() {
    return {
        actionId: "",
        actionName: "",
        // optional: allow selecting values for action if you want later
        actionValues: [] // multi-select of action default_values (if any)
    };
}

export default function RuleBuilder({ mode }) {
    const nav = useNavigate();
    const { id } = useParams(); // rule id for edit

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

    // meta-data for operators/fields/actions
    const [metaLoading, setMetaLoading] = useState(true);
    const [typeOperatorMapping, setTypeOperatorMapping] = useState({});
    const [fields, setFields] = useState([]);
    const [actionsList, setActionsList] = useState([]);

    // IF blocks
    const [allConditions, setAllConditions] = useState([makeConditionRow()]);
    const [anyConditions, setAnyConditions] = useState([makeConditionRow()]);

    // THEN actions
    const [actions, setActions] = useState([makeActionRow()]);

    const fieldsById = useMemo(() => new Map(fields.map((f) => [f.id, f])), [fields]);
    const actionsById = useMemo(() => new Map(actionsList.map((a) => [a.id, a])), [actionsList]);

    const canSubmit = useMemo(() => {
        return (isCreate ? ruleId.trim() : true) && groupId.trim() && ruleName.trim();
    }, [groupId, isCreate, ruleId, ruleName]);

    // Load meta: fields + actions + operator mapping
    useEffect(() => {
        (async () => {
            setErr("");
            setMetaLoading(true);
            try {
                const [metaRes, fieldsRes, actionsRes] = await Promise.all([
                    listDefaultValuesMeta(),
                    listFieldsApi(),
                    listActionsApi()
                ]);

                // default values meta
                const mapping = metaRes?.type_operator_mapping || metaRes?.data?.type_operator_mapping || {};
                setTypeOperatorMapping(mapping);

                // fields
                const fieldsList = Array.isArray(fieldsRes) ? fieldsRes : fieldsRes?.data ?? [];
                // only ACTIVE ones
                setFields(fieldsList.filter((f) => (f.db_status || "").toUpperCase() === "ACTIVE" || !f.db_status));

                // actions
                const acts = Array.isArray(actionsRes) ? actionsRes : actionsRes?.data ?? [];
                setActionsList(acts.filter((a) => (a.db_status || "").toUpperCase() === "ACTIVE" || !a.db_status));
            } catch (e) {
                setErr(e?.response?.data?.message || e.message || "Failed to load fields/actions/operators");
            } finally {
                setMetaLoading(false);
            }
        })();
    }, []);

    // Load rule if edit
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

                // TODO: map backend r.field_operator_values / r.action_id into UI rows.
                // For now keep one empty row each.
                setAllConditions([makeConditionRow()]);
                setAnyConditions([makeConditionRow()]);
                setActions([makeActionRow()]);
            } catch (e) {
                setErr(e?.response?.data?.message || e.message || "Failed to load rule");
            } finally {
                setLoading(false);
            }
        })();
    }, [id, isEdit]);

    // Fetch groups by name prefix (>=4)
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
            } catch (e) {
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
            selectedValueKeys: [],
            inputValue: ""
        });
    }

    function onOperatorChange(setter, idx, op) {
        updateCondition(setter, idx, { operator: op });
    }

    function togglePickValue(setter, idx, key) {
        setter((prev) =>
            prev.map((row, i) => {
                if (i !== idx) return row;
                const set = new Set(row.selectedValueKeys || []);
                if (set.has(key)) set.delete(key);
                else set.add(key);
                return { ...row, selectedValueKeys: Array.from(set) };
            })
        );
    }

    function setManualValue(setter, idx, value) {
        updateCondition(setter, idx, { inputValue: value });
    }

    function onActionSelect(idx, actionId) {
        const a = actionsById.get(actionId);
        updateAction(idx, {
            actionId,
            actionName: a?.field || a?.name || "",
            actionValues: [] // you can allow selecting values later
        });
    }

    async function onSave() {
        setErr("");
        setSaving(true);
        try {
            // TODO: map allConditions/anyConditions/actions to backend schema
            const payload = {
                id: isCreate ? ruleId.trim() : id,
                group_id: groupId.trim(),
                rule_name: ruleName.trim(),
                priority: Number(priority),
                logica_Operator: logicalOperator,
                description: description.trim(),
                status: "ACTIVE",
                version: 1,

                conditions: [],
                field_operator_values: [],
                action_id: actions.map((a) => a.actionId).filter(Boolean),
                actions: []
            };

            if (!payload.group_id) throw new Error("group_id is required");
            if (!payload.rule_name) throw new Error("rule_name is required");
            if (!payload.id) throw new Error("id is required");

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
                <div className="rbMeta">
                    <div className="rbMetaGrid">
                        <label className="field">
                            <span className="label">Rule ID</span>
                            <input
                                className="input"
                                value={isEdit ? id || "" : ruleId}
                                onChange={(e) => setRuleId(e.target.value)}
                                disabled={isEdit}
                            />
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
                                    onBlur={() => {
                                        setTimeout(() => setGroupDropdownOpen(false), 150);
                                    }}
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

                        <label className="field">
                            <span className="label">Logical Operator</span>
                            <select className="input" value={logicalOperator} onChange={(e) => setLogicalOperator(e.target.value)}>
                                <option value="AND">AND</option>
                                <option value="OR">OR</option>
                            </select>
                        </label>

                        <label className="field rbMetaDesc">
                            <span className="label">Description</span>
                            <input className="input" value={description} onChange={(e) => setDescription(e.target.value)} />
                        </label>
                    </div>
                </div>

                {/* IF */}
                <div className="rbSection">
                    <div className="rbSectionTitle">IF</div>

                    <div className="block">
                        <div className="blockTitle">ALL of the following conditions are true:</div>

                        {allConditions.map((row, idx) => {
                            const f = row.fieldId ? fieldsById.get(row.fieldId) : null;
                            const fType = row.fieldType || f?.value_type || "";
                            const ops = typeOperatorMapping?.[fType] || [];
                            const values = f?.values || [];
                            const usePickList = Array.isArray(values) && values.length > 0;

                            return (
                                <div key={idx} className="condRow4">
                                    {/* Field */}
                                    <select className="input" value={row.fieldId} onChange={(e) => onFieldChange(setAllConditions, idx, e.target.value)}>
                                        <option value="">Select field</option>
                                        {fields.map((ff) => (
                                            <option key={ff.id} value={ff.id}>
                                                {ff.name} ({ff.value_type})
                                            </option>
                                        ))}
                                    </select>

                                    {/* Operator */}
                                    <select className="input" value={row.operator} onChange={(e) => onOperatorChange(setAllConditions, idx, e.target.value)} disabled={!row.fieldId}>
                                        <option value="">{row.fieldId ? "Select operator" : "Select field first"}</option>
                                        {ops.map((op) => (
                                            <option key={op} value={op}>
                                                {op}
                                            </option>
                                        ))}
                                    </select>

                                    {/* Value */}
                                    {usePickList ? (
                                        <div className="pickMulti">
                                            <div className="pickHead">Select values</div>
                                            <div className="pickBox">
                                                {values.map((v) => {
                                                    const key = normalizeFieldValueKey(v);
                                                    const label = getFieldValueLabel(v);
                                                    const checked = (row.selectedValueKeys || []).includes(key);
                                                    return (
                                                        <label key={key} className="pickItem">
                                                            <input type="checkbox" checked={checked} onChange={() => togglePickValue(setAllConditions, idx, key)} />
                                                            <span>{label}</span>
                                                        </label>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    ) : (
                                        <ValueInput
                                            valueType={fType}
                                            value={row.inputValue}
                                            onChange={(v) => setManualValue(setAllConditions, idx, v)}
                                            disabled={!row.fieldId}
                                        />
                                    )}

                                    <button className="xBtn" type="button" onClick={() => removeCondition(setAllConditions, idx)} title="Remove">
                                        ×
                                    </button>
                                </div>
                            );
                        })}

                        <button className="addLink" type="button" onClick={addAllCondition}>
                            + Add Condition
                        </button>
                    </div>

                    <div className="andBar">AND</div>

                    <div className="block">
                        <div className="blockTitle">ANY of the following conditions are true:</div>

                        {anyConditions.map((row, idx) => {
                            const f = row.fieldId ? fieldsById.get(row.fieldId) : null;
                            const fType = row.fieldType || f?.value_type || "";
                            const ops = typeOperatorMapping?.[fType] || [];
                            const values = f?.values || [];
                            const usePickList = Array.isArray(values) && values.length > 0;

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
                                            <option key={op} value={op}>
                                                {op}
                                            </option>
                                        ))}
                                    </select>

                                    {usePickList ? (
                                        <div className="pickMulti">
                                            <div className="pickHead">Select values</div>
                                            <div className="pickBox">
                                                {values.map((v) => {
                                                    const key = normalizeFieldValueKey(v);
                                                    const label = getFieldValueLabel(v);
                                                    const checked = (row.selectedValueKeys || []).includes(key);
                                                    return (
                                                        <label key={key} className="pickItem">
                                                            <input type="checkbox" checked={checked} onChange={() => togglePickValue(setAnyConditions, idx, key)} />
                                                            <span>{label}</span>
                                                        </label>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    ) : (
                                        <ValueInput
                                            valueType={fType}
                                            value={row.inputValue}
                                            onChange={(v) => setManualValue(setAnyConditions, idx, v)}
                                            disabled={!row.fieldId}
                                        />
                                    )}

                                    <button className="xBtn" type="button" onClick={() => removeCondition(setAnyConditions, idx)} title="Remove">
                                        ×
                                    </button>
                                </div>
                            );
                        })}

                        <button className="addLink" type="button" onClick={addAnyCondition}>
                            + Add Condition
                        </button>
                    </div>
                </div>

                {/* THEN */}
                <div className="rbSection">
                    <div className="rbSectionTitle">THEN</div>

                    <div className="block">
                        <div className="blockTitle">Perform the following actions:</div>

                        {actions.map((a, idx) => {
                            const actionObj = a.actionId ? actionsById.get(a.actionId) : null;
                            const actionName = actionObj?.field || actionObj?.name || a.actionName || "";

                            return (
                                <div key={idx} className="actionBox">
                                    <div className="actionRow2">
                                        <div className="actionLabel">Action:</div>

                                        <select className="input" value={a.actionId} onChange={(e) => onActionSelect(idx, e.target.value)}>
                                            <option value="">Select action</option>
                                            {actionsList.map((x) => (
                                                <option key={x.id} value={x.id}>
                                                    {x.field || x.name}
                                                </option>
                                            ))}
                                        </select>

                                        <button className="xBtn" type="button" onClick={() => removeAction(idx)} title="Remove">
                                            ×
                                        </button>
                                    </div>

                                    {a.actionId ? (
                                        <div className="actionHint">
                                            Selected: <b>{actionName}</b> • ID: <span className="rbMono">{a.actionId}</span>
                                        </div>
                                    ) : null}
                                </div>
                            );
                        })}

                        <button className="addLink" type="button" onClick={addActionRow}>
                            + Add Action
                        </button>
                    </div>
                </div>

                <div className="rbBottom">
                    <button className="btnSecondary" type="button" onClick={() => nav(-1)} disabled={saving}>
                        Cancel
                    </button>
                    <button className="btnPrimary" type="button" onClick={onSave} disabled={!canSubmit || saving}>
                        {saving ? "Saving..." : "Save Rule"}
                    </button>
                </div>
            </div>
        </div>
    );
}

function ValueInput({ valueType, value, onChange, disabled }) {
    const type = (valueType || "").toUpperCase();

    if (type === "DATE") {
        return <input className="input" type="date" value={value || ""} onChange={(e) => onChange(e.target.value)} disabled={disabled} />;
    }

    if (type === "DATETIME") {
        return <input className="input" type="datetime-local" value={value || ""} onChange={(e) => onChange(e.target.value)} disabled={disabled} />;
    }

    if (type === "TIME") {
        return <input className="input" type="time" value={value || ""} onChange={(e) => onChange(e.target.value)} disabled={disabled} />;
    }

    if (type === "INT" || type === "DOUBLE") {
        return <input className="input" type="number" value={value || ""} onChange={(e) => onChange(e.target.value)} disabled={disabled} />;
    }

    if (type === "BOOLEAN") {
        return (
            <select className="input" value={value || ""} onChange={(e) => onChange(e.target.value)} disabled={disabled}>
                <option value="">Select</option>
                <option value="true">true</option>
                <option value="false">false</option>
            </select>
        );
    }

    // default STRING
    return <input className="input" type="text" value={value || ""} onChange={(e) => onChange(e.target.value)} disabled={disabled} placeholder="Enter value" />;
}