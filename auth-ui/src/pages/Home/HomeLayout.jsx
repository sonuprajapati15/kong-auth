import {NavLink, Outlet, useNavigate} from "react-router-dom";
import {clearAuth, getUser} from "../../config/auth";
import {logOutApi} from "../../services/authApi.js";
import "./HomeLayout.css";

function Item({to, label}) {
    return (
        <NavLink
            to={to}
            end={false}
            className={({isActive}) => `navItem ${isActive ? "navItem--active" : ""}`}
        >
            {label}
        </NavLink>
    );
}

export default function HomeLayout() {
    const nav = useNavigate();
    const user = getUser();

    return (
        <div className="appShell">
            <aside className="sidebar">
                <div className="brand">
                    <div className="brand__logo">SRE</div>
                    <div style={{flexDirection: "column", textAlign: "center"}}>
                        <div className="brand__name">Sonu</div>
                        <div className="brand__name">Easy Rules</div>
                    </div>
                </div>

                <div className="navGroup">
                    <div className="navGroup__title" style={{paddingLeft: "10px", fontSize: "0.85em"}}>General</div>
                    <div style={{display: "flex", paddingLeft: "10px", flexDirection: "column", gap: "0.2px"}}>
                        <Item to="/home/dashboard" label={<span style={{fontSize: "0.75em"}}>DashBoard</span>}/>
                        <Item to="/home/analytics" label={<span style={{fontSize: "0.75em"}}>Analytics</span>}/>
                    </div>
                </div>

                <div className="navGroup">
                    <div className="navGroup__title" style={{fontSize: "0.85em"}}>Transactions</div>
                    <div style={{display: "flex", paddingLeft: "10px", flexDirection: "column", gap: "0.2px"}}>
                        <Item to="/home/payments" label={<span style={{fontSize: "0.75em"}}>Payments</span>}/>
                    </div>
                </div>

                <div className="navGroup">
                    <div className="navGroup__title" style={{paddingLeft: "10px", fontSize: "0.85em"}}>Rule Engine</div>
                    <div style={{display: "flex", paddingLeft: "10px", flexDirection: "column", gap: "0.2px"}}>
                        <Item to="/home/actions" label={<span style={{fontSize: "0.75em"}}>Actions</span>}/>
                        <Item to="/home/fields" label={<span style={{fontSize: "0.75em"}}>Fields</span>}/>
                        <Item to="/home/groups" label={<span style={{fontSize: "0.75em"}}>Groups And Rules</span>}/>
                    </div>
                </div>
                <div className="spacer"/>
                <div className="navGroup">
                    <div className="navGroup__title" style={{paddingLeft: "10px", fontSize: "0.85em"}}>User Info</div>
                    <div style={{
                        display: "flex",
                        paddingBottom: "30px",
                        flexDirection: "column",
                        gap: "0.2px"
                    }}>
                        <Item to="/home/userchiplayout" label={<span style={{fontSize: "0.75em"}}>  🙎🏻‍ Users</span>}/>
                    </div>
                </div>
            </aside>
            <main className="content">
                <div className="contentInner">
                    <Outlet/>
                </div>
            </main>
        </div>
    );
}