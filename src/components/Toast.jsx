export default function Toast({ toast }) {
  return (
    <div
      style={{
        position: 'fixed',
        bottom: 22,
        left: '50%',
        transform: toast.visible
          ? 'translateX(-50%) translateY(0)'
          : 'translateX(-50%) translateY(14px)',
        background: 'var(--s2)',
        border: '1px solid var(--bdr-h)',
        borderRadius: 'var(--r-pill)',
        padding: '11px 22px',
        fontSize: 13,
        color: 'var(--text)',
        opacity: toast.visible ? 1 : 0,
        transition: 'all .25s',
        pointerEvents: 'none',
        zIndex: 200,
        boxShadow: '0 4px 20px rgba(0,0,0,.4)',
        whiteSpace: 'nowrap',
      }}
    >
      {toast.message}
    </div>
  );
}
