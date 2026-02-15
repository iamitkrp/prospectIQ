export default function CampaignsLoading() {
    return (
        <>
            <div className="page-header">
                <div className="skeleton" style={{ width: "160px", height: "28px", borderRadius: "6px" }} />
                <div className="skeleton" style={{ width: "100px", height: "16px", borderRadius: "4px", marginTop: "6px" }} />
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: "1rem", marginTop: "1rem" }}>
                {[1, 2, 3].map((i) => (
                    <div key={i} className="skeleton" style={{ height: "140px", borderRadius: "12px" }} />
                ))}
            </div>
        </>
    );
}
