import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { signupApi } from "../../services/authApi.js";
import { setAuth } from "../../config/auth.js";
import "./Signup.css";

export default function Signup() {
    const nav = useNavigate();

    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [keepUpdated, setKeepUpdated] = useState(false);

    const [loading, setLoading] = useState(false);
    const [errMsg, setErrMsg] = useState("");

    async function onSubmit(e) {
        e.preventDefault();
        setErrMsg("");
        setLoading(true);
        try {
            const { token, user } = await signupApi({ email, password });

            if (token) {
                setAuth({ token, user });
                nav("/home", { replace: true });
            } else {
                nav("/login", { replace: true, state: { signup: true } });
            }
        } catch (err) {
            const apiMsg = err?.response?.data?.message || err?.response?.data?.error;
            setErrMsg(apiMsg || err.message || "Signup failed");
        } finally {
            setLoading(false);
        }
    }

    return (
        <div className="signupPage">
            <div className="signupShell">
                <aside className="leftPane">
                    <div className="leftImg" />
                    <div className="quoteCard">
                        <p className="quote">
                            “App makes it easy to invest in real estate using cryptocurrency.
                            Whether I’m buying luxury villas or fractional shares in commercial
                            properties, every transaction is seamless, secure, and transparent.”
                        </p>
                        <div className="quoteMeta">
                            <div className="quoteName">Isabella Garcia</div>
                            <div className="quoteOrg">Layers Capital</div>
                            <div className="quoteRole">Global Real Estate Investment Firm</div>
                        </div>
                    </div>
                </aside>

                <main className="rightPane">
                    <div className="topTabs">
                        <Link className="tab" to="/login">Login</Link>
                        <span className="tab tab--active">Sign Up</span>
                    </div>

                    <h1 className="title">Create an account</h1>
                    <p className="subtitle">Please enter your details to create an account.</p>

                    <div className="providerList">
                        <button type="button" className="providerBtn">Continue with Google</button>
                        <button type="button" className="providerBtn">Continue with Apple</button>
                        <button type="button" className="providerBtn">Continue with Binance</button>
                        <button type="button" className="providerBtn">Continue with Wallet</button>
                    </div>

                    <div className="orRow">
                        <span />
                        <span>OR</span>
                        <span />
                    </div>

                    <form className="form" onSubmit={onSubmit}>
                        <label className="field">
                            <span className="label">Email address</span>
                            <input
                                className="input"
                                type="email"
                                placeholder="Enter your email address"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                required
                                autoComplete="email"
                            />
                        </label>

                        <label className="field">
                            <span className="label">Password</span>
                            <input
                                className="input"
                                type="password"
                                placeholder="Enter your password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                required
                                autoComplete="new-password"
                            />
                        </label>

                        <button className="primaryBtn" type="submit" disabled={loading}>
                            {loading ? "Creating..." : "Create an account"}
                        </button>

                        {errMsg ? <div className="error">{errMsg}</div> : null}

                        <label className="checkRow">
                            <input
                                type="checkbox"
                                checked={keepUpdated}
                                onChange={(e) => setKeepUpdated(e.target.checked)}
                            />
                            <span>
                Please keep me updated by email with the latest news, research findings,
                reward programs, event updates.
              </span>
                        </label>

                        <div className="bottomText">
                            Already have an account? <Link className="link" to="/login">Sign in</Link>
                        </div>
                    </form>
                </main>
            </div>
        </div>
    );
}