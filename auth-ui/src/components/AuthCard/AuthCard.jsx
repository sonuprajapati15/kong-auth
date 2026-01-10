import "./AuthCard.css";

export default function AuthCard({ icon, title, subtitle, children }) {
    return (
        <div className="authCard">
            {icon ? <div className="authCard__icon">{icon}</div> : null}
            <h1 className="authCard__title">{title}</h1>
            {subtitle ? <p className="authCard__subtitle">{subtitle}</p> : null}
            <div className="authCard__content">{children}</div>
        </div>
    );
}