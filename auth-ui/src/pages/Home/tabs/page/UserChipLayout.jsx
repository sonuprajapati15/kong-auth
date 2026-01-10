import "../../HomeLayout.css";
import {useNavigate} from "react-router-dom";
import {clearAuth, getUser} from "../../../../config/auth.js";
import {logOutApi} from "../../../../services/authApi.js";


export default function UserChipLayout() {
    const nav = useNavigate();
    const user = getUser();


    function onLogoutConfirm() {
        clearAuth();
        nav("/login", {replace: true});
    }

    function onLogout() {
        if (window.confirm("Are you sure you want to logout?")) {
            logOutApi({email: user?.email})
                .catch(() => {
                })
                .finally(onLogoutConfirm);
        }
    }

    return (
        <div>
            <div style={{display: "flex", flexDirection: "row"}}>
                <button className="logoutBtn" onClick={onLogout}>
                    Logout
                </button>
            </div>
        </div>

    );
}