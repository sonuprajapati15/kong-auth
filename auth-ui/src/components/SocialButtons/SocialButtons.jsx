import "./SocialButtons.css";

function SocialButton({ children, onClick, ariaLabel }) {
    return (
        <button className="socialBtn" type="button" onClick={onClick} aria-label={ariaLabel}>
            {children}
        </button>
    );
}

export default function SocialButtons({ onGoogle, onFacebook, onApple }) {
    return (
        <div className="socialRow">
            <SocialButton onClick={onGoogle} ariaLabel="Continue with Google">
                <span style={{ color: "green", fontSize: "1rem" }}>G</span>
            </SocialButton>
            <SocialButton onClick={onFacebook} ariaLabel="Continue with Facebook">
                <span style={{ color: "blue", fontSize: "1rem" }}>f</span>
            </SocialButton>
            <SocialButton onClick={onApple} ariaLabel="Continue with Apple">
                <span style={{ fontSize: "1rem" }}></span>
            </SocialButton>
        </div>
    );
}