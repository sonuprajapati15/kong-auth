import { useEffect, useMemo, useState } from "react";
import "../css/Actions.css";
import {
    createActionApi,
    deleteActionApi,
    listActionsApi,
    updateActionApi
} from "../../../../services/actionsApi.js";

function formatDate(iso) {
    if (!iso) return "—";
    try {
        return new Date(iso).toLocaleString();
    } catch {
        return iso;
    }
}

function mapRow(a) {
    return {
        id: a.id,
        actionName: a.field ?? a.name ?? "—",
        createdAt: a.created_date_time,
        createdBy: a.created_by ?? a.createdBy ?? null,
        updatedAt: a.updated_date_time,
        updatedBy: a.updated_by ?? a.updatedBy ?? null,
        status: a.db_status ?? a.status ?? "—",
        comment: a.comment ?? "",
        values: a.default_values ?? a.values ?? []
    };
}

export default function Actions() {
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

    const [name, setName] = useState("");
    const [comment, setComment] = useState("");
    const [valuesText, setValuesText] = useState("");

    const isPanelOpen = mode !== "view";

    async function refresh() {
        setErr("");
        setLoading(true);
        try {
            const data = await listActionsApi();
            const list = Array.isArray(data) ? data : data?.data ?? [];
            setRows(list.map(mapRow));

            // keep selected if still exists
            setSelectedId((prev) => (list.some((x) => x.id === prev) ? prev : null));
        } catch (e) {
            setErr(e?.response?.data?.message || e.message || "Failed to load actions");
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
        setName("");
        setComment("");
        setValuesText("");
    }

    // IMPORTANT: we no longer open the edit panel when clicking a row
    // Row click will only select/highlight it.
    function onRowClick(r) {
        setSelectedId(r.id);
    }

    // OPTIONAL: if you still want an "Edit" button inside table or header,
    // you can enable editing only after selecting a row by calling this.
    function openEditSelected() {
        if (!selected) return;
        setMode("edit");
        setName(selected.actionName === "—" ? "" : selected.actionName);
        setComment(selected.comment || "");
        setValuesText((selected.values || []).join(", "));
    }

    function closePanel() {
        setMode("view");
        setSelectedId(null); // hide + clear selection (as you requested)
        setName("");
        setComment("");
        setValuesText("");
        setErr("");
    }

    async function onSave() {
        setErr("");
        setSaving(true);
        try {
            const payload = {
                name: name.trim(),
                values: valuesText
                    .split(",")
                    .map((s) => s.trim())
                    .filter(Boolean),
                comment: comment.trim()
            };

            if (!payload.name) throw new Error("Action name is required");

            if (mode === "create") {
                await createActionApi(payload);
            } else if (mode === "edit" && selectedId) {
                await updateActionApi(selectedId, payload);
            }

            await refresh();
            closePanel(); // hide panel after save
        } catch (e) {
            setErr(e?.response?.data?.message || e.message || "Save failed");
        } finally {
            setSaving(false);
        }
    }

    async function onDelete() {
        if (!selectedId) return;
        const ok = confirm("Delete this action?");
        if (!ok) return;

        setErr("");
        setSaving(true);
        try {
            await deleteActionApi(selectedId);
            await refresh();
            closePanel(); // hide panel after delete
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
                    <div className="title">Actions</div>
                    <div className="subtitle">Manage action definitions</div>
                </div>

                <div className="actionsHeader__right">
                    <button className="btnSecondary" onClick={refresh} disabled={loading || saving}>
                        Refresh
                    </button>

                    {/* Optional Edit button: only enabled when a row is selected */}
                    <button
                        className="btnSecondary"
                        onClick={openEditSelected}
                        disabled={loading || saving || !selectedId}
                        title={!selectedId ? "Select a row to edit" : "Edit selected action"}
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
                        <div className="empty">No actions found.</div>
                    ) : (
                        <table className="table">
                            <thead>
                            <tr>
                                <th>Action name</th>
                                <th>Created at</th>
                                <th>Created by</th>
                                <th>Updated at</th>
                                <th>Updated by</th>
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
                                    <td className="mono">{r.actionName}</td>
                                    <td>{formatDate(r.createdAt)}</td>
                                    <td>{r.createdBy || "—"}</td>
                                    <td>{formatDate(r.updatedAt)}</td>
                                    <td>{r.updatedBy || "—"}</td>
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

                {/* Render edit card ONLY when panel is open */}
                {isPanelOpen ? (
                    <aside className="editCard">
                        <div className="editHeader">
                            <div className="editTitle">
                                {mode === "create" ? "Create action" : "Edit action"}
                            </div>
                            <button className="btnSecondary" onClick={closePanel} disabled={saving}>
                                Close
                            </button>
                        </div>

                        <div className="form">
                            <label className="field">
                                <span className="label">Action name</span>
                                <input className="input" value={name} onChange={(e) => setName(e.target.value)} />
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

                            {mode === "edit" && selected ? (
                                <div className="meta">
                                    <div><b>ID:</b> {selected.id}</div>
                                    <div><b>DB Status:</b> {selected.status}</div>
                                    <div><b>Created:</b> {formatDate(selected.createdAt)}</div>
                                    <div><b>Updated:</b> {formatDate(selected.updatedAt)}</div>
                                </div>
                            ) : null}
                        </div>
                    </aside>
                ) : null}
            </div>
        </div>
    );
}