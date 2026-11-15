// Interactive floor plan. Booths come from /booths/expo/:id and update live via sockets.
export default function FloorPlan({ expo, booths, myBoothId, onSelect, selectedId }) {
  const cols = expo?.floorPlan?.cols || Math.max(1, ...booths.map((b) => b.col + 1));
  return (
    <>
      <div className="legend" aria-hidden="true">
        <span><i style={{ borderColor: '#22c55e', background: '#f0fdf4' }} />Available</span>
        <span><i style={{ borderColor: '#94a3b8', background: '#f1f5f9' }} />Reserved</span>
        <span><i style={{ borderColor: '#ef4444', background: '#fef2f2' }} />Blocked</span>
        {myBoothId && <span><i style={{ borderColor: '#4f46e5', background: '#eef0ff' }} />Your booth</span>}
      </div>
      <div className="floor" style={{ gridTemplateColumns: `repeat(${cols}, minmax(78px, 1fr))` }}>
        {booths.map((b) => {
          const mine = myBoothId && b._id === myBoothId;
          return (
            <button
              key={b._id}
              type="button"
              className={`booth ${mine ? 'mine' : b.status} ${b.size === 'large' ? 'large' : ''}`}
              style={{ gridRow: b.row + 1, gridColumn: b.col + 1, outline: selectedId === b._id ? '3px solid #4f46e5' : undefined }}
              onClick={() => onSelect && onSelect(b)}
              aria-label={`Booth ${b.code}, ${b.status}${b.profile ? ', ' + b.profile.companyName : ''}`}
            >
              <b>{b.code}</b>
              <span>{b.profile ? b.profile.companyName : b.status === 'available' ? `$${b.price}` : b.status}</span>
            </button>
          );
        })}
      </div>
    </>
  );
}
