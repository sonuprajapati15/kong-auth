import { useEffect, useMemo, useState } from "react";
import "../css/Actions.css"; // reuse same styles OR create Fields.css
import {
    createFieldApi,
    deleteFieldApi,
    listFieldsApi,
    updateFieldApi
} from "../../../../services/fieldsApi.js";

function formatDate(iso) {
    if (!iso) return "—";
    try {
        return new Date(iso).toLocaleString();
    } catch {
        return iso;
    }
}

function mapRow(f) {
    // We don't have a sample GET response shape for fields, so we map flexibly
    return {
        id: f.id ?? f._id ?? null,
        name: f.name ?? "—",
        fieldType: f.field_type ?? f.fieldType ?? "—",
        values: f.values ?? f.default_values ?? [],
        comment: f.comment ?? "",
        createdAt: f.created_date_time ?? f.createdAt ?? null,
        updatedAt: f.updated_date_time ?? f.updatedAt ?? null,
        status: f.db_status ?? f.status ?? "—"
    };
}

export default function Fields() {
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [err, setErr] = useState("");

    const [rows, setRows] = useState([]);
    const [selectedId, setSelectedId] = useState(null);

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
    const [fieldType, setFieldType] = useState("STRING");
    const [valuesText, setValuesText] = useState("");
    const [comment, setComment] = useState("");

    async function refresh() {
        setErr("");
        setLoading(true);
        try {
            const data = await listFieldsApi();
            const list = Array.isArray(data) ? data : data?.data ?? [];
            setRows(list.map(mapRow));
            setSelectedId((prev) => (list.some((x) => x.id === prev) ? prev : null));
        } catch (e) {
            setErr(e?.response?.data?.message || e.message || "Failed to load fields");
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        refresh();
    }, []);

    function openCreate() {
        setMode("create");
        setSelectedId(null);
        setId("");
        setName("");
        setFieldType("STRING");
        setValuesText("");
        setComment("");
    }

    function onRowClick(r) {
        setSelectedId(r.id);
    }

    function openEditSelected() {
        if (!selected) return;
        setMode("edit");
        setId(selected.id || "");
        setName(selected.name === "—" ? "" : selected.name);
        setFieldType(selected.fieldType || "STRING");
        setValuesText((selected.values || []).join(", "));
        setComment(selected.comment || "");
    }

    function closePanel() {
        setMode("view");
        setSelectedId(null);
        setErr("");
    }

    async function onSave() {
        setErr("");
        setSaving(true);
        try {
            const payload = {
                id: id.trim(),
                name: name.trim(),
                field_type: fieldType,
                values: valuesText
                    .split(",")
                    .map((s) => s.trim())
                    .filter(Boolean),
                comment: comment.trim()
            };

            if (!payload.name) throw new Error("Field name is required");
            if (!payload.field_type) throw new Error("Field type is required");

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
                </div>

                <div className="actionsHeader__right">
                    <button className="btnSecondary" onClick={refresh} disabled={loading || saving}>
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

                    <button className="btnPrimary" onClick={openCreate} disabled={loading || saving}>
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
                            <div className="editTitle">
                                {mode === "create" ? "Create field" : "Edit field"}
                            </div>
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
                                    disabled={mode === "edit"}  // id usually not editable in edit mode
                                    placeholder="field-123 or backend id"
                                />
                            </label>

                            <label className="field">
                                <span className="label">Field name</span>
                                <input className="input" value={name} onChange={(e) => setName(e.target.value)} />
                            </label>

                            <label className="field">
                                <span className="label">Field type</span>
                                <select className="input" value={fieldType} onChange={(e) => setFieldType(e.target.value)}>
                                    <option value="STRING">STRING</option>
                                    <option value="NUMBER">NUMBER</option>
                                    <option value="BOOLEAN">BOOLEAN</option>
                                    <option value="DATE">DATE</option>
                                </select>
                            </label>

                            <label className="field">
                                <span className="label">Values (comma separated)</span>
                                <input
                                    className="input"
                                    value={valuesText}
                                    onChange={(e) => setValuesText(e.target.value)}
                                    placeholder="value1, value2"
                                />
                            </label>

                            <label className="field">
                                <span className="label">Comment</span>
                                <textarea className="textarea" rows={4} value={comment} onChange={(e) => setComment(e.target.value)} />
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