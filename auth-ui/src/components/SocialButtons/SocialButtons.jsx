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
            <SocialButton onClick={onGoogle} ariaLabel="Continue with Google">G</SocialButton>
            <SocialButton onClick={onFacebook} ariaLabel="Continue with Facebook">f</SocialButton>
            <SocialButton onClick={onApple} ariaLabel="Continue with Apple"></SocialButton>
        </div>
    );
}