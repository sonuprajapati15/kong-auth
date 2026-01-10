import { useMemo, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import AuthCard from "../../components/AuthCard/AuthCard.jsx";
import SocialButtons from "../../components/SocialButtons/SocialButtons.jsx";
import { loginApi } from "../../services/authApi.js";
import { setAuth } from "../../config/auth.js";
import "./Login.css";

function ArrowIcon() {
    return (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M10 17l5-5-5-5" stroke="#0f172a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M4 12h11" stroke="#0f172a" strokeWidth="2" strokeLinecap="round" />
        </svg>
    );
}

export default function Login() {
    const nav = useNavigate();
    const location = useLocation();
    const redirectTo = useMemo(() => location.state?.from || "/home", [location.state]);

    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [showPw, setShowPw] = useState(false);
    const [loading, setLoading] = useState(false);
    const [errMsg, setErrMsg] = useState("");

    async function onSubmit(e) {
        e.preventDefault();
        setErrMsg("");
        setLoading(true);
        try {
            const { token, user, raw } = await loginApi({ email, password });
            if (!token) {
                throw new Error(
                    raw?.message ||
                    "Login succeeded but no token was returned. Backend must return token/accessToken/jwt."
                );
            }
            setAuth({ token, user });
            nav(redirectTo, { replace: true });
        } catch (err) {
            const apiMsg = err?.response?.data?.message || err?.response?.data?.error;
            setErrMsg(apiMsg || err.message || "Login failed");
        } finally {
            setLoading(false);
        }
    }

    return (
        <div className="loginBg">
            <div className="loginWrap">
                <AuthCard
                    icon={<ArrowIcon />}
                    title="Sign in with email"
                    subtitle="Make a new doc to bring your words, data, and teams together. For free"
                >
                    <form className="form" onSubmit={onSubmit}>
                        <label className="field">
                            <span className="field__label">Email</span>
                            <input
                                className="input"
                                type="email"
                                placeholder="Email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                required
                                autoComplete="email"
                            />
                        </label>

                        <label className="field">
                            <span className="field__label">Password</span>
                            <div className="pwRow">
                                <input
                                    className="input"
                                    type={showPw ? "text" : "password"}
                                    placeholder="Password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    required
                                    autoComplete="current-password"
                                />
                                <button
                                    type="button"
                                    className="pwToggle"
                                    onClick={() => setShowPw((s) => !s)}
                                    aria-label={showPw ? "Hide password" : "Show password"}
                                >
                                    {showPw ? "Hide" : "Show"}
                                </button>
                            </div>
                        </label>

                        <div className="rowBetween">
                            <span />
                            <a className="link" href="#" onClick={(e) => e.preventDefault()}>
                                Forgot password?
                            </a>
                        </div>

                        {errMsg ? <div className="error">{errMsg}</div> : null}

                        <button className="primaryBtn" type="submit" disabled={loading}>
                            {loading ? "Signing in..." : "Get Started"}
                        </button>

                        <div className="divider">
                            <span>or sign in with</span>
                        </div>

                        <SocialButtons
                            onGoogle={() => alert("Hook Google OAuth here")}
                            onFacebook={() => alert("Hook Facebook OAuth here")}
                            onApple={() => alert("Hook Apple OAuth here")}
                        />

                        <div className="footerText">
                            New here? <Link className="link" to="/signup">Create an account</Link>
                        </div>
                    </form>
                </AuthCard>
            </div>
        </div>
    );
}