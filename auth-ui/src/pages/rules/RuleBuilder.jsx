import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import "./css/RuleBuilder.css";
import { createRuleApi, getRuleApi, updateRuleApi, deleteRuleApi } from "../../services/rulesApi.js";

const FIELD_OPTIONS = ["Status", "Priority", "Category", "Created Date", "Contract address"];
const OP_OPTIONS = ["equals", "not equals", "contains", "is greater than", "is before", "is after"];
const VALUE_OPTIONS = ["Open", "Closed", "High", "Low", "Bug", "7 days ago", "aave"];

const ACTION_OPTIONS = ["Send Email", "Update Field"];
const TO_OPTIONS = ["Assignee", "Reporter", "Admin"];
const SUBJECT_OPTIONS = ["Issue Notification", "Reminder", "Escalation"];

function makeConditionRow() {
    return { field: "Status", op: "equals", value: "Open" };
}

function makeActionRow() {
    return { action: "Send Email", to: "Assignee", subject: "Issue Notification", field: "Status", setTo: "Resolved" };
}

export default function RuleBuilder({ mode }) {
    const nav = useNavigate();
    const { id } = useParams(); // rule id for edit

    const isCreate = mode === "create";
    const isEdit = mode === "edit";

    const [loading, setLoading] = useState(Boolean(isEdit));
    const [saving, setSaving] = useState(false);
    const [err, setErr] = useState("");

    // top meta
    const [ruleId, setRuleId] = useState("");
    const [groupId, setGroupId] = useState("");
    const [ruleName, setRuleName] = useState("");
    const [priority, setPriority] = useState(1);
    const [logicalOperator, setLogicalOperator] = useState("AND");
    const [description, setDescription] = useState("");

    // IF blocks
    const [allConditions, setAllConditions] = useState([makeConditionRow()]);
    const [anyConditions, setAnyConditions] = useState([makeConditionRow()]);

    // THEN actions
    const [actions, setActions] = useState([makeActionRow()]);

    const canSubmit = useMemo(() => {
        return (isCreate ? ruleId.trim() : true) && groupId.trim() && ruleName.trim();
    }, [groupId, isCreate, ruleId, ruleName]);

    useEffect(() => {
        if (!isEdit) return;

        (async () => {
            setErr("");
            setLoading(true);
            try {
                const r = await getRuleApi(id);

                setRuleId(r.id || "");
                setGroupId(r.group_id || "");
                setRuleName(r.rule_name || "");
                setPriority(Number(r.priority || 1));
                setLogicalOperator(r.logica_Operator || "AND");
                setDescription(r.description || "");

                // We don’t know your exact UI mapping for conditions/actions arrays yet.
                // For now: show placeholder rows if empty.
                setAllConditions((r.conditions?.length ? r.conditions : []).length ? [makeConditionRow()] : [makeConditionRow()]);
                setAnyConditions([makeConditionRow()]);
                setActions([makeActionRow()]);
            } catch (e) {
                setErr(e?.response?.data?.message || e.message || "Failed to load rule");
            } finally {
                setLoading(false);
            }
        })();
    }, [id, isEdit]);

    function addAllCondition() {
        setAllConditions((prev) => [...prev, makeConditionRow()]);
    }

    function addAnyCondition() {
        setAnyConditions((prev) => [...prev, makeConditionRow()]);
    }

    function addAction() {
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

    async function onSave() {
        setErr("");
        setSaving(true);
        try {
            // NOTE: Here we send the exact API fields you showed.
            // Later, we can map the UI conditions/actions into:
            // conditions[], field_operator_values[], action_id[], actions[]
            const payload = {
                id: isCreate ? ruleId.trim() : id,
                group_id: groupId.trim(),
                rule_name: ruleName.trim(),
                priority: Number(priority),
                logica_Operator: logicalOperator,
                description: description.trim(),
                status: "ACTIVE",
                version: 1,

                // keeping these arrays empty until you confirm final schema mapping
                conditions: [],
                field_operator_values: [],
                action_id: [],
                actions: []
            };

            if (!payload.group_id) throw new Error("group_id is required");
            if (!payload.rule_name) throw new Error("rule_name is required");
            if (!payload.id) throw new Error("id is required");

            if (isCreate) {
                await createRuleApi(payload);
            } else {
                await updateRuleApi(payload);
            }

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
            {loading ? <div className="card"><div className="empty">Loading…</div></div> : null}

            <div className="card">
                <div className="rbMeta">
                    <div className="rbMetaGrid">
                        <label className="field">
                            <span className="label">Rule ID</span>
                            <input className="input" value={isEdit ? (id || "") : ruleId} onChange={(e) => setRuleId(e.target.value)} disabled={isEdit} />
                        </label>
                        <label className="field">
                            <span className="label">Group ID</span>
                            <input className="input" value={groupId} onChange={(e) => setGroupId(e.target.value)} placeholder="group-123" />
                        </label>
                        <label className="field">
                            <span className="label">Rule name</span>
                            <input className="input" value={ruleName} onChange={(e) => setRuleName(e.target.value)} placeholder="Sample Rule" />
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
                            <input className="input" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Main rule description" />
                        </label>
                    </div>
                </div>

                {/* IF */}
                <div className="rbSection">
                    <div className="rbSectionTitle">IF</div>

                    <div className="block">
                        <div className="blockTitle">ALL of the following conditions are true:</div>

                        {allConditions.map((row, idx) => (
                            <div key={idx} className="condRow">
                                <select className="input" value={row.field} onChange={(e) => updateCondition(setAllConditions, idx, { field: e.target.value })}>
                                    {FIELD_OPTIONS.map((x) => <option key={x} value={x}>{x}</option>)}
                                </select>

                                <select className="input" value={row.op} onChange={(e) => updateCondition(setAllConditions, idx, { op: e.target.value })}>
                                    {OP_OPTIONS.map((x) => <option key={x} value={x}>{x}</option>)}
                                </select>

                                <select className="input" value={row.value} onChange={(e) => updateCondition(setAllConditions, idx, { value: e.target.value })}>
                                    {VALUE_OPTIONS.map((x) => <option key={x} value={x}>{x}</option>)}
                                </select>

                                <button className="xBtn" onClick={() => removeCondition(setAllConditions, idx)} title="Remove">×</button>
                            </div>
                        ))}

                        <button className="addLink" onClick={addAllCondition}>+ Add Condition</button>
                    </div>

                    <div className="andBar">AND</div>

                    <div className="block">
                        <div className="blockTitle">ANY of the following conditions are true:</div>

                        {anyConditions.map((row, idx) => (
                            <div key={idx} className="condRow">
                                <select className="input" value={row.field} onChange={(e) => updateCondition(setAnyConditions, idx, { field: e.target.value })}>
                                    {FIELD_OPTIONS.map((x) => <option key={x} value={x}>{x}</option>)}
                                </select>

                                <select className="input" value={row.op} onChange={(e) => updateCondition(setAnyConditions, idx, { op: e.target.value })}>
                                    {OP_OPTIONS.map((x) => <option key={x} value={x}>{x}</option>)}
                                </select>

                                <select className="input" value={row.value} onChange={(e) => updateCondition(setAnyConditions, idx, { value: e.target.value })}>
                                    {VALUE_OPTIONS.map((x) => <option key={x} value={x}>{x}</option>)}
                                </select>

                                <button className="xBtn" onClick={() => removeCondition(setAnyConditions, idx)} title="Remove">×</button>
                            </div>
                        ))}

                        <button className="addLink" onClick={addAnyCondition}>+ Add Condition</button>
                    </div>
                </div>

                {/* THEN */}
                <div className="rbSection">
                    <div className="rbSectionTitle">THEN</div>

                    <div className="block">
                        <div className="blockTitle">Perform the following actions:</div>

                        {actions.map((a, idx) => (
                            <div key={idx} className="actionBox">
                                <div className="actionRow">
                                    <div className="actionLabel">Action:</div>
                                    <select className="input" value={a.action} onChange={(e) => updateAction(idx, { action: e.target.value })}>
                                        {ACTION_OPTIONS.map((x) => <option key={x} value={x}>{x}</option>)}
                                    </select>

                                    <button className="xBtn" onClick={() => removeAction(idx)} title="Remove">×</button>
                                </div>

                                {a.action === "Send Email" ? (
                                    <div className="grid3">
                                        <div className="miniRow">
                                            <div className="actionLabel">To:</div>
                                            <select className="input" value={a.to} onChange={(e) => updateAction(idx, { to: e.target.value })}>
                                                {TO_OPTIONS.map((x) => <option key={x} value={x}>{x}</option>)}
                                            </select>
                                        </div>
                                        <div className="miniRow">
                                            <div className="actionLabel">Subject:</div>
                                            <select className="input" value={a.subject} onChange={(e) => updateAction(idx, { subject: e.target.value })}>
                                                {SUBJECT_OPTIONS.map((x) => <option key={x} value={x}>{x}</option>)}
                                            </select>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="grid3">
                                        <div className="miniRow">
                                            <div className="actionLabel">Field:</div>
                                            <select className="input" value={a.field} onChange={(e) => updateAction(idx, { field: e.target.value })}>
                                                {FIELD_OPTIONS.map((x) => <option key={x} value={x}>{x}</option>)}
                                            </select>
                                        </div>
                                        <div className="miniRow">
                                            <div className="actionLabel">to</div>
                                            <select className="input" value={a.setTo} onChange={(e) => updateAction(idx, { setTo: e.target.value })}>
                                                {VALUE_OPTIONS.map((x) => <option key={x} value={x}>{x}</option>)}
                                            </select>
                                        </div>
                                    </div>
                                )}
                            </div>
                        ))}

                        <button className="addLink" onClick={addAction}>+ Add Action</button>
                    </div>
                </div>

                <div className="rbBottom">
                    <button className="btnSecondary" onClick={() => nav(-1)} disabled={saving}>Cancel</button>
                    <button className="btnPrimary" onClick={onSave} disabled={!canSubmit || saving}>
                        {saving ? "Saving..." : "Save Rule"}
                    </button>
                </div>
            </div>
        </div>
    );
}