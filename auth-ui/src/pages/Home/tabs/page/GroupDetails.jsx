import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import "../css/GroupDetails.css";
import { createGroupApi, getGroupApi } from "../../../../services/groupApi";

function formatDate(iso) {
    if (!iso) return "—";
    try {
        return new Date(iso).toLocaleString();
    } catch {
        return iso;
    }
}

export default function GroupDetails() {
    const { id } = useParams(); // can be parent or child group id
    const nav = useNavigate();

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [err, setErr] = useState("");

    const [group, setGroup] = useState(null);
    const [childGroups, setChildGroups] = useState([]);

    // Add child form (works for any group as parent)
    const [childName, setChildName] = useState("");

    const childIds = useMemo(() => group?.child_group_ids || [], [group]);

    async function load() {
        setErr("");
        setLoading(true);
        try {
            const g = await getGroupApi(id);
            setGroup(g);

            if (!g?.child_group_ids?.length) {
                setChildGroups([]);
            } else {
                // Fetch each child details so we can display names/dates + add 👁 action
                const children = await Promise.all(g.child_group_ids.map((cid) => getGroupApi(cid)));
                setChildGroups(children);
            }
        } catch (e) {
            setErr(e?.response?.data?.message || e.message || "Failed to load group details");
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        load();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [id]);

    async function onAddChild() {
        setErr("");
        setSaving(true);
        try {
            if (!childName.trim()) throw new Error("Child group name is required");

            await createGroupApi({
                group_name: childName.trim(),
                parent_group_id: id
            });

            setChildName("");
            await load();
        } catch (e) {
            setErr(e?.response?.data?.message || e.message || "Failed to create child group");
        } finally {
            setSaving(false);
        }
    }

    return (
        <div className="gdPage">
            <div className="gdHeader">
                <div>
                    <div className="gdCrumb">
                        <button className="linkBtn" onClick={() => nav("/home/automation-groups")}>
                            Automation Groups
                        </button>
                        <span>&nbsp;›&nbsp; Group Details</span>
                    </div>

                    <div className="gdTitle">{group?.group_name || "Group Details"}</div>
                    <div className="gdSub">
                        ID: <span className="mono">{id}</span>
                    </div>
                </div>

                <div className="gdHeaderRight">
                    <button className="btnSecondary" onClick={load} disabled={loading || saving}>
                        Refresh
                    </button>
                </div>
            </div>

            {err ? <div className="error">{err}</div> : null}

            <div className="gdGrid">
                <section className="card">
                    <div className="cardHead">
                        <div className="cardTitle">Group Info</div>
                    </div>

                    {loading ? (
                        <div className="empty">Loading…</div>
                    ) : !group ? (
                        <div className="empty">Group not found.</div>
                    ) : (
                        <div className="info">
                            <div><b>Name:</b> {group.group_name}</div>
                            <div><b>Depth:</b> {group.depth}</div>
                            <div><b>Created At: </b> {formatDate(group.created_at)} <b>By</b> {group.created_by}</div>
                            <div><b>Updated At: </b> {formatDate(group.updated_at)} <b>By</b> {group.updated_by}</div>
                            <div><b>Rules:</b> {(group.rules_ids || []).length}</div>
                            <div><b>Group Hierarchy :</b> {group.hierarchy}</div>
                            <div><b>Child groups:</b> {(group.child_group_ids || []).length}</div>

                            {(group.rules_names || []).length ? (
                                <>
                                    <div style={{ marginTop: 10, fontWeight: 900 }}>Rule names</div>
                                    <div className="pillWrap">
                                        {group.rules_names.map((n) => (
                                            <span key={n} className="pill">{n}</span>
                                        ))}
                                    </div>
                                </>
                            ) : null}
                        </div>
                    )}
                </section>

                <section className="card">
                    <div className="cardHead">
                        <div className="cardTitle">Add Child Group</div>
                    </div>

                    <div className="panelBody">
                        <label className="field">
                            <span className="label">Child group name</span>
                            <input
                                className="input"
                                value={childName}
                                onChange={(e) => setChildName(e.target.value)}
                                placeholder="Group child name"
                            />
                        </label>

                        <button className="btnPrimary" onClick={onAddChild} disabled={saving || loading}>
                            {saving ? "Creating..." : "Add child group"}
                        </button>
                    </div>
                </section>

                <section className="card gdFull">
                    <div className="cardHead">
                        <div className="cardTitle">Child Groups</div>
                        <div className="cardMeta">{childIds.length} items</div>
                    </div>

                    {loading ? (
                        <div className="empty">Loading…</div>
                    ) : childIds.length === 0 ? (
                        <div className="empty">No child groups.</div>
                    ) : (
                        <table className="table">
                            <thead>
                            <tr>
                                <th>Name</th>
                                <th>Child Group ID</th>
                                <th>No of Rules</th>
                                <th>Child Group Count</th>
                                <th>Created at</th>
                                <th>Updated at</th>
                                <th style={{ width: 120 }}>Action</th>
                            </tr>
                            </thead>
                            <tbody>
                            {childGroups.map((c) => (
                                <tr key={c.id}>
                                    <td className="nameMain">{c.group_name}</td>
                                    <td className="mono">{c.id}</td>
                                    <td className="mono">{(c.rules_ids || []).length}</td>
                                    <td className="mono"> {(c.child_group_ids || []).length}</td>
                                    <td>{formatDate(c.created_at)}</td>
                                    <td>{formatDate(c.updated_at)}</td>
                                    <td>
                                        <button
                                            className="iconBtn"
                                            title="View child details"
                                            onClick={() => nav(`/home/groupDetails/${c.id}`)}
                                        >
                                            👁
                                        </button>
                                    </td>
                                </tr>
                            ))}
                            </tbody>
                        </table>
                    )}
                </section>
            </div>
        </div>
    );
}