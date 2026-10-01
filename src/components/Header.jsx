import Icon from './Icon.jsx';

export default function Header({ onHelp }) {
  return (
    <header className="site-header">
      <div className="brand" aria-label="Third Time">
        <span className="brand-mark" aria-hidden="true"><i /><i /><i /></span>
        <span>third time<span className="brand-dot">.</span></span>
      </div>
      <button className="help-button" onClick={onHelp}><Icon name="help" /><span>How to play</span></button>
    </header>
  );
}
