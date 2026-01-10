import { useNavigate } from "react-router-dom";
import { clearAuth, getUser } from "../../config/auth";
import "./Home.css";

export default function Home() {
    const nav = useNavigate();
    const user = getUser();

    return (
        <div className="homePage">
            <div className="homeCard">
                <h1>Home</h1>
                <p>You are logged in.</p>

                <pre className="userBox">{JSON.stringify(user, null, 2)}</pre>

                <button
                    className="btn"
                    onClick={() => {
                        clearAuth();
                        nav("/login", { replace: true });
                    }}
                >
                    Logout
                </button>
            </div>
        </div>
    );
}