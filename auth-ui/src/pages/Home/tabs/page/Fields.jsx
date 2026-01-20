import { useEffect, useMemo, useState } from "react";
import "../css/Actions.css"; // reuse same styles OR create Fields.css
import {
    createFieldApi,
    deleteFieldApi,
    listFieldsApi,
    updateFieldApi,
} from "../../../../services/fieldsApi.js";
import {listDefaultValuesMeta} from "../../../../services/defaultValuesApi.js";

function formatDate(iso) {
    if (!iso) return "—";
    try {
        return new Date(iso).toLocaleString();
    } catch {
        return iso;
    }
}

function mapRow(f) {
    return {
        id: f.id ?? f._id ?? null,
        name: f.name ?? "—",
        fieldType: f.value_type ?? f.field_type ?? f.fieldType ?? "—",
        values: Array.isArray(f.values) ? f.values : [],
        comment: f.comment ?? "",
        createdAt: f.created_date_time ?? f.createdDateTime ?? f.createdAt ?? null,
        updatedAt: f.updated_date_time ?? f.updatedDateTime ?? f.updatedAt ?? null,
        status: f.db_status ?? f.dbStatus ?? f.status ?? "—",
        createdBy: f.created_by ?? f.createdBy ?? "",
        updatedBy: f.updated_by ?? f.updatedBy ?? "",
    };
}

function normType(t) {
    return String(t || "").toUpperCase();
}

function fieldTypeToInputKey(type) {
    switch (normType(type)) {
        case "BOOLEAN":
            return "boolValue";
        case "INT":
            return "intValue";
        case "DOUBLE":
            return "doubleValue";
        case "DATE":
            return "localDate";
        case "DATETIME":
            return "localDateTime";
        case "TIME":
            return "localTime";
        case "STRING":
        default:
            return "stringValue";
    }
}

function parseValuesTextToFieldTypeList(type, valuesText) {
    const t = normType(type);
    const inputKey = fieldTypeToInputKey(t);

    const parts = (valuesText || "")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);

    const toOne = (raw) => {
        let parsed;
        switch (inputKey) {
            case "boolValue": {
                const v = raw.toLowerCase();
                if (v === "true" || v === "1" || v === "yes") parsed = true;
                else if (v === "false" || v === "0" || v === "no") parsed = false;
                else parsed = null;
                break;
            }
            case "intValue": {
                const n = Number(raw);
                parsed = Number.isFinite(n) ? parseInt(String(n), 10) : null;
                break;
            }
            case "doubleValue": {
                const n = Number(raw);
                parsed = Number.isFinite(n) ? n : null;
                break;
            }
            case "localDate":
            case "localDateTime":
            case "localTime":
            case "stringValue":
            default:
                parsed = raw;
                break;
        }

        return { type: t, [inputKey]: parsed };
    };

    return parts.map(toOne);
}

function valuesListToText(type, values) {
    const inputKey = fieldTypeToInputKey(type);
    if (!Array.isArray(values) || values.length === 0) return "";
    return values
        .map((v) => {
            const val = v?.[inputKey];
            return val === null || val === undefined ? "" : String(val);
        })
        .filter(Boolean)
        .join(", ");
}

// --- UI helpers for DATE/TIME/DATETIME pickers ---

function toHtmlDateValue(v) {
    // expects "YYYY-MM-DD"
    return v || "";
}

function toHtmlTimeValue(v) {
    // expects "HH:mm" or "HH:mm:ss" -> input[type=time] accepts HH:mm (seconds depends on step)
    if (!v) return "";
    // if backend uses HH:mm:ss keep it; browser will still show it when step allows seconds
    return v;
}

function toHtmlDateTimeLocalValue(v) {
    // HTML expects "YYYY-MM-DDTHH:mm" (optionally with :ss)
    // If value already is "YYYY-MM-DDTHH:mm:ss" keep it.
    return v || "";
}

export default function Fields() {
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [err, setErr] = useState("");

    const [rows, setRows] = useState([]);
    const [selectedId, setSelectedId] = useState(null);

    // meta from /default-values
    const [metaLoading, setMetaLoading] = useState(true);
    const [types, setTypes] = useState([]);
    const [typeOperatorMapping, setTypeOperatorMapping] = useState({});

    const selected = useMemo(
        () => rows.find((r) => r.id === selectedId) || null,
        [rows, selectedId]
    );

    // view | create | edit
    const [mode, setMode] = useState("view");
    const isPanelOpen = mode !== "view";

    // form state
    const [id, setId] = useState("");
    const [name, setName] = useState("");
    const [fieldType, setFieldType] = useState(""); // defaulted from meta
    const [valuesText, setValuesText] = useState("");
    const [comment, setComment] = useState("");

    // for DATE/TIME/DATETIME we use a picker for a *single* value and also support "Add" into comma list
    const [pickerValue, setPickerValue] = useState("");

    const normalizedType = normType(fieldType);

    const allowedOperatorsForSelectedType = useMemo(() => {
        const mapping = typeOperatorMapping || {};
        const ops = mapping?.[normalizedType];
        return Array.isArray(ops) ? ops : [];
    }, [typeOperatorMapping, normalizedType]);

    const showOperatorBlock = true; // always show, but it will be empty if mapping missing

    const isDate = normalizedType === "DATE";
    const isTime = normalizedType === "TIME";
    const isDateTime = normalizedType === "DATETIME";

    async function refresh() {
        setErr("");
        setLoading(true);
        try {
            const data = await listFieldsApi();
            const list = Array.isArray(data) ? data : data?.data ?? [];
            const mapped = list.map(mapRow);
            setRows(mapped);
            setSelectedId((prev) => (mapped.some((x) => x.id === prev) ? prev : null));
        } catch (e) {
            setErr(e?.response?.data?.message || e.message || "Failed to load fields");
        } finally {
            setLoading(false);
        }
    }

    async function refreshMeta() {
        setMetaLoading(true);
        try {
            const meta = await listDefaultValuesMeta();
            setTypes(Array.isArray(meta?.types) ? meta.types : []);
            setTypeOperatorMapping(meta?.type_operator_mapping || {});
            setFieldType((prev) => prev || (meta?.types?.[0] ?? "STRING"));
        } catch (e) {
            setErr(
                e?.response?.data?.message ||
                e.message ||
                "Failed to load field types/operators (default-values)"
            );
            // fallback types but mapping missing => operators list will be empty until backend loads
            setTypes(["BOOLEAN", "STRING", "INT", "DOUBLE", "DATE", "DATETIME", "TIME"]);
            setTypeOperatorMapping({});
            setFieldType((prev) => prev || "STRING");
        } finally {
            setMetaLoading(false);
        }
    }

    useEffect(() => {
        (async () => {
            await refreshMeta();
            await refresh();
        })();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // When type changes, reset value inputs (avoids mixing formats)
    useEffect(() => {
        setPickerValue("");
        setValuesText("");
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [normalizedType]);

    function openCreate() {
        setMode("create");
        setSelectedId(null);
        setId("");
        setName("");
        setFieldType(types?.[0] ?? "STRING");
        setValuesText("");
        setComment("");
        setPickerValue("");
    }

    function onRowClick(r) {
        setSelectedId(r.id);
    }

    function openEditSelected() {
        if (!selected) return;
        setMode("edit");
        setId(selected.id || "");
        setName(selected.name === "—" ? "" : selected.name);

        const ft = selected.fieldType || types?.[0] || "STRING";
        setFieldType(ft);

        setValuesText(valuesListToText(ft, selected.values || []));
        setComment(selected.comment || "");
        setPickerValue("");
    }

    function closePanel() {
        setMode("view");
        setSelectedId(null);
        setErr("");
        setPickerValue("");
    }

    function addPickerValueToList() {
        if (!pickerValue) return;

        // For DATETIME, keep seconds out unless user provides them; HTML usually provides YYYY-MM-DDTHH:mm
        const v = pickerValue.trim();
        if (!v) return;

        setValuesText((prev) => {
            const base = (prev || "").trim();
            if (!base) return v;
            return `${base}, ${v}`;
        });
        setPickerValue("");
    }

    async function onSave() {
        setErr("");
        setSaving(true);
        try {
            const payload = {
                id: id.trim(),
                name: name.trim(),
                field_type: normalizedType,
                values: parseValuesTextToFieldTypeList(normalizedType, valuesText),
                comment: comment.trim(),
            };

            if (!payload.name) throw new Error("Field name is required");
            if (!normalizedType) throw new Error("Field type is required");
            if (!payload.comment) throw new Error("Comment is required");

            if (mode === "create") {
                await createFieldApi(payload);
            } else if (mode === "edit") {
                if (!payload.id) throw new Error("Field id is required");
                await updateFieldApi(payload);
            }

            await refresh();
            closePanel();
        } catch (e) {
            setErr(e?.response?.data?.message || e.message || "Save failed");
        } finally {
            setSaving(false);
        }
    }

    async function onDelete() {
        if (!selectedId) return;
        const ok = confirm("Delete this field?");
        if (!ok) return;

        setErr("");
        setSaving(true);
        try {
            await deleteFieldApi(selectedId);
            await refresh();
            closePanel();
        } catch (e) {
            setErr(e?.response?.data?.message || e.message || "Delete failed");
        } finally {
            setSaving(false);
        }
    }

    return (
        <div className="actionsPage">
            <div className="actionsHeader">
                <div>
                    <div className="title">Fields</div>
                    <div className="subtitle">Manage fields definitions</div>
                    {metaLoading ? <div className="subtitle">Loading field types/operators…</div> : null}
                </div>

                <div className="actionsHeader__right">
                    <button
                        className="btnSecondary"
                        onClick={async () => {
                            await refreshMeta();
                            await refresh();
                        }}
                        disabled={loading || saving || metaLoading}
                    >
                        Refresh
                    </button>

                    <button
                        className="btnSecondary"
                        onClick={openEditSelected}
                        disabled={loading || saving || !selectedId}
                        title={!selectedId ? "Select a row to edit" : "Edit selected field"}
                    >
                        Edit
                    </button>

                    <button className="btnPrimary" onClick={openCreate} disabled={loading || saving || metaLoading}>
                        Create new
                    </button>
                </div>
            </div>

            {err ? <div className="error">{err}</div> : null}

            <div className={`actionsGrid ${isPanelOpen ? "" : "actionsGrid--single"}`}>
                <section className="tableCard">
                    {loading ? (
                        <div className="empty">Loading…</div>
                    ) : rows.length === 0 ? (
                        <div className="empty">No fields found.</div>
                    ) : (
                        <table className="table">
                            <thead>
                            <tr>
                                <th>Field name</th>
                                <th>Field type</th>
                                <th>Created at</th>
                                <th>Updated at</th>
                                <th>Status</th>
                            </tr>
                            </thead>
                            <tbody>
                            {rows.map((r) => (
                                <tr
                                    key={r.id}
                                    className={r.id === selectedId ? "rowActive" : ""}
                                    onClick={() => onRowClick(r)}
                                    role="button"
                                    tabIndex={0}
                                >
                                    <td className="mono">{r.name}</td>
                                    <td>{r.fieldType}</td>
                                    <td>{formatDate(r.createdAt)}</td>
                                    <td>{formatDate(r.updatedAt)}</td>
                                    <td>
                      <span className={`pill ${String(r.status).includes("ACTIVE") ? "pill--ok" : ""}`}>
                        {r.status}
                      </span>
                                    </td>
                                </tr>
                            ))}
                            </tbody>
                        </table>
                    )}
                </section>

                {isPanelOpen ? (
                    <aside className="editCard">
                        <div className="editHeader">
                            <div className="editTitle">{mode === "create" ? "Create field" : "Edit field"}</div>
                            <button className="btnSecondary" onClick={closePanel} disabled={saving}>
                                Close
                            </button>
                        </div>

                        <div className="form">
                            <label className="field">
                                <span className="label">Field ID</span>
                                <input
                                    className="input"
                                    value={id}
                                    onChange={(e) => setId(e.target.value)}
                                    disabled={mode === "edit"}
                                    placeholder="field-123 or backend id"
                                />
                            </label>

                            <label className="field">
                                <span className="label">Field name</span>
                                <input className="input" value={name} onChange={(e) => setName(e.target.value)} />
                            </label>

                            <label className="field">
                                <span className="label">Field type</span>
                                <select
                                    className="input"
                                    value={fieldType}
                                    onChange={(e) => setFieldType(e.target.value)}
                                >
                                    {(types?.length ? types : ["STRING"]).map((t) => (
                                        <option key={t} value={t}>
                                            {t}
                                        </option>
                                    ))}
                                </select>
                            </label>

                            {/* Operators MUST be derived from type_operator_mapping */}
                            {showOperatorBlock ? (
                                <div className="field">
                                    <div className="label">Operators (based on selected type)</div>
                                    <div className="mono" style={{ fontSize: 12, opacity: 0.85 }}>
                                        {allowedOperatorsForSelectedType.length
                                            ? allowedOperatorsForSelectedType.join(", ")
                                            : "—"}
                                    </div>
                                </div>
                            ) : null}

                            <label className="field">
                                <span className="label">Comment</span>
                                <textarea
                                    className="textarea"
                                    rows={4}
                                    value={comment}
                                    onChange={(e) => setComment(e.target.value)}
                                />
                            </label>

                            <div className="formRow">
                                <button className="btnPrimary" onClick={onSave} disabled={saving}>
                                    {saving ? "Saving..." : "Save"}
                                </button>

                                {mode === "edit" ? (
                                    <button className="btnDanger" onClick={onDelete} disabled={saving}>
                                        Delete
                                    </button>
                                ) : null}
                            </div>
                        </div>
                    </aside>
                ) : null}
            </div>
        </div>
    );
}